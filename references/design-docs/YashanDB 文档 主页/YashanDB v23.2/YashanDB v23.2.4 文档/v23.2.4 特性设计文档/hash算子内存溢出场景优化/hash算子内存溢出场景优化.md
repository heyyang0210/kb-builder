Created by 李嘉瑞, last modified on 五月 10, 2024

*详细设计-YDBRD-26328 : Hash Group/Join Optimization Design（hash算子内存溢出场景优化方案设计）*

* IR链接：*  *YDBRD-29538*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/661942e3fd997db58ad8c152](https://pingcode.yasdb.com/pjm/items/661942e3fd997db58ad8c152)    *?*    
  *#YDBRD-26328 hash group/hash join内存溢出场景的优化*

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

文档所解决的主要问题场景如下：

- COLUMNAR_VM_BUFFER_SIZE参数值调大以后未生效，执行资源和存储任务等无法使用改大后的内存。
- Hash Group/Join算子在内存不足时使用了分批计算（资源不足时执行时间变长），其他会话释放内存后，依旧使用分批计算，在执行资源充足的时候无法加快计算。


###   [1.2 需求分析](#12-需求分析)  

- COLUMNAR_VM_BUFFER_SIZE参数实时判断是否生效
- Hash Group/Join算子增加判断，当内存充足时，申请新的配额，尽量加快计算


####   [1.2.1 hash算子内存溢出场景性能分析](#121-hash算子内存溢出场景性能分析)  

- 我们分别取两条具有代表性的tpch语句测试，（Q13测试大数据量hash join的性能，Q18测试大数据量hash group的性能）
- 测试环境使用192.168.8.105，lsc表100Gtpch数据
- Q13测试结果如下：


```
- 内存充足时，autotrace信息：
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | E - Rows | A - Rows | Cost(%CPU)  | A - Time | Loops    | Memory   | Disk     | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |        44|             |   6312742|        44|          |          |                                |
|  1 |  COL TO ROW                    |                      |            |          |        44|             |   6312736|        44|          |          |                                |
|  2 |   PX COORDINATOR               |                      |            |          |        44|             |   6285926|          |          |          |                                |
|  3 |    PX N2I LOCAL                | QUEUE_0              |            |      1000|        44|     3713( 0)|   6285915|          |          |          |                                |
|  4 |     SORT ORDER BY              |                      |            |      1000|         2|     3711( 0)|   6284272|          |          |          |                                |
|  5 |      HASH GROUP                |                      |            |      1000|         2|     3710( 0)|   6284248|          |          |          |                                |
|* 6 |       PX N2N LOCAL             | QUEUE_1              |            |      1000|        32|     3710( 0)|   6284000|          |          |          |                                |
|  7 |        HASH GROUP              |                      |            |      1000|        42|     3710( 0)|   6253233|          |          |          |                                |
|  8 |         RESULT                 |                      |            |  15000000|    624988|     3656( 0)|   6240473|          |          |          |                                |
|  9 |          HASH GROUP            |                      |            |  15000000|    624988|     3656( 0)|   6239578|          |          |          |                                |
|*10 |           HASH JOIN INNER      |                      |            | 148934640|   9269622|     2806( 0)|   5057579|          |          |          |                                |
| 11 |            JOIN FILTER USE     |                      |            | 148934656|   9275943|     2415( 0)|   2933971|          |          |          |                                |
|*12 |             PX N2N LOCAL       | QUEUE_2              |            | 148934656|   9275943|     2415( 0)|   2932122|          |          |          |                                |
| 13 |              PX PART ITERATOR  | DEGREE_16            |            | 148934656|   9273885|     2294( 0)|   2525982|          |          |          |                                |
|*14 |               TABLE ACCESS FULL| ORDERS               | REGRESS    | 148934656|          |     2294( 0)|          |          |          |          |                                |
|*15 |            JOIN FILTER CREATE  |                      |            |  15000000|          |      168( 0)|          |          |          |          |                                |
| 16 |             PX PART ITERATOR   | DEGREE_16            |            |  15000000|    937500|      168( 0)|     35968|          |          |          |                                |
| 17 |              TABLE ACCESS FULL | CUSTOMER             | REGRESS    |  15000000|          |      168( 0)|          |          |          |          |                                |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+

语句实际执行时间为6秒多，其中有五秒在执行hash join

```

- 不同参数下的性能：


```
- 1.
alter system set columnar_vm_buffer_size=1G scope=memory;
alter system set columnar_material_percent=40 scope=memory;
alter system set columnar_max_operator_mem_percent=60 scope=memory;
11.154

```

```
- 2.
alter system set columnar_vm_buffer_size=800M scope=memory;
alter system set columnar_material_percent=40 scope=memory;
alter system set columnar_max_operator_mem_percent=60 scope=memory;
15.670

```

```
- 3.
alter system set columnar_vm_buffer_size=600M scope=memory;
alter system set columnar_material_percent=40 scope=memory;
alter system set columnar_max_operator_mem_percent=60 scope=memory;
16.530

```

```
- 4.
alter system set columnar_vm_buffer_size=600M scope=memory;
alter system set columnar_material_percent=40 scope=memory;
alter system set columnar_max_operator_mem_percent=40 scope=memory;
Elapsed: 00:00:23.103
autotrace信息：
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | E - Rows | A - Rows | Cost(%CPU)  | A - Time | Loops    | Memory   | Disk     | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |        44|             |  22750183|        44|          |          |                                |
|  1 |  COL TO ROW                    |                      |            |          |        44|             |  22750176|        44|          |          |                                |
|  2 |   PX COORDINATOR               |                      |            |          |        44|             |  22729294|          |          |          |                                |
|  3 |    PX N2I LOCAL                | QUEUE_0              |            |      1000|        44|     3713( 0)|  22729285|          |          |          |                                |
|  4 |     SORT ORDER BY              |                      |            |      1000|         2|     3711( 0)|  22724299|          |          |          |                                |
|  5 |      HASH GROUP                |                      |            |      1000|         2|     3710( 0)|  22724277|          |          |          |                                |
|* 6 |       PX N2N LOCAL             | QUEUE_1              |            |      1000|        32|     3710( 0)|  22724183|          |          |          |                                |
|  7 |        HASH GROUP              |                      |            |      1000|        42|     3710( 0)|  22717641|          |          |          |                                |
|  8 |         RESULT                 |                      |            |  15000000|    624983|     3656( 0)|  22709204|          |          |          |                                |
|  9 |          HASH GROUP            |                      |            |  15000000|    624983|     3656( 0)|  22709060|          |          |          |                                |
|*10 |           HASH JOIN INNER      |                      |            | 148934640|   9277489|     2806( 0)|  19167180|          |          |          |                                |
| 11 |            JOIN FILTER USE     |                      |            | 148934656|   9275943|     2415( 0)|   2023708|          |          |          |                                |
|*12 |             PX N2N LOCAL       | QUEUE_2              |            | 148934656|   9275943|     2415( 0)|   2022135|          |          |          |                                |
| 13 |              PX PART ITERATOR  | DEGREE_16            |            | 148934656|   9273569|     2294( 0)|   1659869|          |          |          |                                |
|*14 |               TABLE ACCESS FULL| ORDERS               | REGRESS    | 148934656|          |     2294( 0)|          |          |          |          |                                |
|*15 |            JOIN FILTER CREATE  |                      |            |  15000000|          |      168( 0)|          |          |          |          |                                |
| 16 |             PX PART ITERATOR   | DEGREE_16            |            |  15000000|    937500|      168( 0)|      2377|          |          |          |                                |
| 17 |              TABLE ACCESS FULL | CUSTOMER             | REGRESS    |  15000000|          |      168( 0)|          |          |          |          |                                |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
[Build] Time : 952741  [Build] Memory : 2111056  [After join condition] count : 11735094  [After join filter] count : 0  [Hash Table max conflict] count : 5  [hash table] array name : 1 dimension vector [hash table] memory : 1572864  [hash table] rebuild times : 37  [batch number] : 32  [batch file count] : 4  [RowCountStatistics]  : [0,512]:3, (512, 1024]:374, (1024,2048]:424, &gt;2048:2088

```

```
- 5.
alter system set columnar_vm_buffer_size=600M scope=memory;
alter system set columnar_material_percent=20 scope=memory;
alter system set columnar_max_operator_mem_percent=40 scope=memory;
Elapsed: 00:00:44.488
autotrace信息：
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | E - Rows | A - Rows | Cost(%CPU)  | A - Time | Loops    | Memory   | Disk     | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |        44|             |  44932862|        44|          |          |                                |
|  1 |  COL TO ROW                    |                      |            |          |        44|             |  44932856|        44|          |          |                                |
|  2 |   PX COORDINATOR               |                      |            |          |        44|             |  44911219|          |          |          |                                |
|  3 |    PX N2I LOCAL                | QUEUE_0              |            |      1000|        44|     3713( 0)|  44911209|          |          |          |                                |
|  4 |     SORT ORDER BY              |                      |            |      1000|         3|     3711( 0)|  44910877|          |          |          |                                |
|  5 |      HASH GROUP                |                      |            |      1000|         3|     3710( 0)|  44910849|          |          |          |                                |
|* 6 |       PX N2N LOCAL             | QUEUE_1              |            |      1000|        46|     3710( 0)|  44910769|          |          |          |                                |
|  7 |        HASH GROUP              |                      |            |      1000|        44|     3710( 0)|  44904259|          |          |          |                                |
|  8 |         RESULT                 |                      |            |  15000000|    624994|     3656( 0)|  44895743|          |          |          |                                |
|  9 |          HASH GROUP            |                      |            |  15000000|    624994|     3656( 0)|  44895550|          |          |          |                                |
|*10 |           HASH JOIN INNER      |                      |            | 148934640|   9275943|     2806( 0)|  36707636|          |          |          |                                |
| 11 |            JOIN FILTER USE     |                      |            | 148934656|   9277489|     2415( 0)|   2243526|          |          |          |                                |
|*12 |             PX N2N LOCAL       | QUEUE_2              |            | 148934656|   9277489|     2415( 0)|   2242341|          |          |          |                                |
| 13 |              PX PART ITERATOR  | DEGREE_16            |            | 148934656|   9273847|     2294( 0)|   1677554|          |          |          |                                |
|*14 |               TABLE ACCESS FULL| ORDERS               | REGRESS    | 148934656|          |     2294( 0)|          |          |          |          |                                |
|*15 |            JOIN FILTER CREATE  |                      |            |  15000000|          |      168( 0)|          |          |          |          |                                |
| 16 |             PX PART ITERATOR   | DEGREE_16            |            |  15000000|    937499|      168( 0)|      3233|          |          |          |                                |
| 17 |              TABLE ACCESS FULL | CUSTOMER             | REGRESS    |  15000000|          |      168( 0)|          |          |          |          |                                |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
[Build] Time : 2018305  [Build] Memory : 1089828  [After join condition] count : 10312650  [After join filter] count : 0  [Hash Table max conflict] count : 5  [hash table] array name : 1 dimension vector [hash table] memory : 786432  [hash table] rebuild times : 72  [batch number] : 64  [batch file count] : 2  [RowCountStatistics]  : [0,512]:1, (512, 1024]:157, (1024,2048]:234, &gt;2048:2172

```

```
- 6.
alter system set columnar_vm_buffer_size=600M scope=memory;
alter system set columnar_material_percent=20 scope=memory;
alter system set columnar_max_operator_mem_percent=20 scope=memory;
Elapsed: 00:02:18.759
autotrace信息：
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | E - Rows | A - Rows | Cost(%CPU)  | A - Time | Loops    | Memory   | Disk     | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |        44|             | 140084247|        44|          |          |                                |
|  1 |  COL TO ROW                    |                      |            |          |        44|             | 140084237|        44|          |          |                                |
|  2 |   PX COORDINATOR               |                      |            |          |        44|             | 140062890|          |          |          |                                |
|  3 |    PX N2I LOCAL                | QUEUE_0              |            |      1000|        44|     3713( 0)| 140062879|          |          |          |                                |
|  4 |     SORT ORDER BY              |                      |            |      1000|         3|     3711( 0)| 140060164|          |          |          |                                |
|  5 |      HASH GROUP                |                      |            |      1000|         3|     3710( 0)| 140060143|          |          |          |                                |
|* 6 |       PX N2N LOCAL             | QUEUE_1              |            |      1000|        48|     3710( 0)| 140060065|          |          |          |                                |
|  7 |        HASH GROUP              |                      |            |      1000|        42|     3710( 0)| 140053827|          |          |          |                                |
|  8 |         RESULT                 |                      |            |  15000000|    624996|     3656( 0)| 140041803|          |          |          |                                |
|  9 |          HASH GROUP            |                      |            |  15000000|    624996|     3656( 0)| 140040745|          |          |          |                                |
|*10 |           HASH JOIN INNER      |                      |            | 148934640|   9271980|     2806( 0)|  72523994|          |          |          |                                |
| 11 |            JOIN FILTER USE     |                      |            | 148934656|   9272123|     2415( 0)|   2281081|          |          |          |                                |
|*12 |             PX N2N LOCAL       | QUEUE_2              |            | 148934656|   9272123|     2415( 0)|   2280117|          |          |          |                                |
| 13 |              PX PART ITERATOR  | DEGREE_16            |            | 148934656|   9273885|     2294( 0)|   1780956|          |          |          |                                |
|*14 |               TABLE ACCESS FULL| ORDERS               | REGRESS    | 148934656|          |     2294( 0)|          |          |          |          |                                |
|*15 |            JOIN FILTER CREATE  |                      |            |  15000000|          |      168( 0)|          |          |          |          |                                |
| 16 |             PX PART ITERATOR   | DEGREE_16            |            |  15000000|    937500|      168( 0)|      1863|          |          |          |                                |
| 17 |              TABLE ACCESS FULL | CUSTOMER             | REGRESS    |  15000000|          |      168( 0)|          |          |          |          |                                |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
上图可以看出内存不足时，Hash group执行时间占比已经占到了一半

同时分析10层autotrace信息：
  10 - Projection: Tuple[0, 1][INTEGER], Tuple[1, 0][INTEGER]   
       Execution : 
[Build] Time : 3929315  [Build] Memory : 576787  [After join condition] count : 9845943  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 9  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:0, (512, 1024]:68, (1024,2048]:119, &gt;2048:2228 
[Build] Time : 3765728  [Build] Memory : 579367  [After join condition] count : 9839836  [After join filter] count : 0  [Hash Table max conflict] count : 5  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 9  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:1, (512, 1024]:91, (1024,2048]:102, &gt;2048:2218 
[Build] Time : 4176379  [Build] Memory : 578577  [After join condition] count : 9835314  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 9  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:1, (512, 1024]:56, (1024,2048]:121, &gt;2048:2229 
[Build] Time : 4052920  [Build] Memory : 581264  [After join condition] count : 9854109  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 379504  [hash table] rebuild times : 140  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:1, (512, 1024]:101, (1024,2048]:104, &gt;2048:2217 
[Build] Time : 3966289  [Build] Memory : 580351  [After join condition] count : 9863395  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 9  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:2, (512, 1024]:128, (1024,2048]:102, &gt;2048:2208 
[Build] Time : 3985102  [Build] Memory : 649985  [After join condition] count : 9834875  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 142  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:2, (512, 1024]:81, (1024,2048]:109, &gt;2048:2211 
[Build] Time : 4148560  [Build] Memory : 580705  [After join condition] count : 9864117  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 141  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:1, (512, 1024]:132, (1024,2048]:105, &gt;2048:2201 
[Build] Time : 3831666  [Build] Memory : 576416  [After join condition] count : 9832473  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 142  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:0, (512, 1024]:56, (1024,2048]:116, &gt;2048:2234 
[Build] Time : 4052712  [Build] Memory : 578238  [After join condition] count : 9845827  [After join filter] count : 0  [Hash Table max conflict] count : 5  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 140  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:1, (512, 1024]:67, (1024,2048]:133, &gt;2048:2215 
[Build] Time : 4192327  [Build] Memory : 580447  [After join condition] count : 9861673  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 140  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:2, (512, 1024]:127, (1024,2048]:107, &gt;2048:2203 
[Build] Time : 4060332  [Build] Memory : 576755  [After join condition] count : 9834920  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 9  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:2, (512, 1024]:47, (1024,2048]:125, &gt;2048:2229 
[Build] Time : 4151727  [Build] Memory : 577255  [After join condition] count : 9837042  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 9  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:1, (512, 1024]:76, (1024,2048]:98, &gt;2048:2230 
[Build] Time : 4142105  [Build] Memory : 577706  [After join condition] count : 9850598  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 9  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:1, (512, 1024]:73, (1024,2048]:121, &gt;2048:2223 
[Build] Time : 4109673  [Build] Memory : 580738  [After join condition] count : 9861399  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 140  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:3, (512, 1024]:115, (1024,2048]:114, &gt;2048:2202 
[Build] Time : 3946288  [Build] Memory : 582737  [After join condition] count : 9858780  [After join filter] count : 0  [Hash Table max conflict] count : 5  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 9  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:1, (512, 1024]:112, (1024,2048]:120, &gt;2048:2199 
[Build] Time : 4000964  [Build] Memory : 579802  [After join condition] count : 9864527  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 393216  [hash table] rebuild times : 9  [batch number] : 128  [batch file count] : 2  [RowCountStatistics]  : [0,512]:5, (512, 1024]:131, (1024,2048]:102, &gt;2048:2200 
       Predicate : access(Tuple[0, 0] = Tuple[1, 0])
逻辑批次有128批，但是实际的一次处理批次数只有第一批（后面的所有批次全部放在一起，执行到后面的批次时再重新分批写入文件）。

当我们通过修改代码，控制使其实际批次与逻辑批次相同时，执行时间与autotrace信息如下：
Elapsed: 00:01:21.347
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | E - Rows | A - Rows | Cost(%CPU)  | A - Time | Loops    | Memory   | Disk     | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |        44|             |  81328942|        44|          |          |                                |
|  1 |  COL TO ROW                    |                      |            |          |        44|             |  81328933|        44|          |          |                                |
|  2 |   PX COORDINATOR               |                      |            |          |        44|             |  81308082|          |          |          |                                |
|  3 |    PX N2I LOCAL                | QUEUE_0              |            |      1000|        44|     3713( 0)|  81308072|          |          |          |                                |
|  4 |     SORT ORDER BY              |                      |            |      1000|         3|     3711( 0)|  81307801|          |          |          |                                |
|  5 |      HASH GROUP                |                      |            |      1000|         3|     3710( 0)|  81307778|          |          |          |                                |
|* 6 |       PX N2N LOCAL             | QUEUE_1              |            |      1000|        48|     3710( 0)|  81307697|          |          |          |                                |
|  7 |        HASH GROUP              |                      |            |      1000|        42|     3710( 0)|  81301242|          |          |          |                                |
|  8 |         RESULT                 |                      |            |  15000000|    624996|     3656( 0)|  81289241|          |          |          |                                |
|  9 |          HASH GROUP            |                      |            |  15000000|    624996|     3656( 0)|  81288095|          |          |          |                                |
|*10 |           HASH JOIN INNER      |                      |            | 148934640|   9275009|     2806( 0)|   6410016|          |          |          |                                |
| 11 |            JOIN FILTER USE     |                      |            | 148934656|   9273880|     2415( 0)|   1950065|          |          |          |                                |
|*12 |             PX N2N LOCAL       | QUEUE_2              |            | 148934656|   9273880|     2415( 0)|   1948318|          |          |          |                                |
| 13 |              PX PART ITERATOR  | DEGREE_16            |            | 148934656|   9273471|     2294( 0)|   1590676|          |          |          |                                |
|*14 |               TABLE ACCESS FULL| ORDERS               | REGRESS    | 148934656|          |     2294( 0)|          |          |          |          |                                |
|*15 |            JOIN FILTER CREATE  |                      |            |  15000000|          |      168( 0)|          |          |          |          |                                |
| 16 |             PX PART ITERATOR   | DEGREE_16            |            |  15000000|    937499|      168( 0)|      1409|          |          |          |                                |
| 17 |              TABLE ACCESS FULL | CUSTOMER             | REGRESS    |  15000000|          |      168( 0)|          |          |          |          |                                |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
[Build] Time : 1025775  [Build] Memory : 628145  [After join condition] count : 18482006  [After join filter] count : 0  [Hash Table max conflict] count : 4  [hash table] array name : 1 dimension vector [hash table] memory : 379216  [hash table] rebuild times : 224  [batch number] : 128  [batch file count] : 128  [RowCountStatistics]  : [0,512]:0, (512, 1024]:0, (1024,2048]:4, &gt;2048:2300

```

```
- 7.alter system set columnar_vm_buffer_size=600M scope=memory;
alter system set columnar_material_percent=20 scope=memory;
alter system set columnar_max_operator_mem_percent=15 scope=memory;
长时间执行（半个小时）不出结果，通过火焰图可以确定主要是hash group执行慢

```

- Q18测试结果：


```
内存充足时，autotrace信息：
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | E - Rows | A - Rows | Cost(%CPU)  | A - Time | Loops    | Memory   | Disk     | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |          |             |          |          |          |          |                                |
|  1 |  COL TO ROW                    |                      |            |       100|          |   767464( 0)|          |          |          |          |                                |
|  2 |   WINDOW                       |                      |            |       100|       100|   767464( 0)|   5206672|          |          |          |                                |
|  3 |    PX COORDINATOR              |                      |            |          |       612|             |   5206656|          |          |          |                                |
|  4 |     PX N2I LOCAL               | QUEUE_0              |            |       100|       612|   767464( 0)|   5206654|          |          |          |                                |
|  5 |      WINDOW                    |                      |            |       100|        31|   767462( 0)|   5206083|          |          |          |                                |
|  6 |       TOP SORT                 |                      |            |     29814|        31|   767462( 0)|   5206076|          |          |          |                                |
|  7 |        HASH GROUP              |                      |            |     29814|        31|   767461( 0)|   5206047|          |          |          |                                |
|* 8 |         HASH JOIN INNER        |                      |            |     29814|       217|   767458( 0)|   5205997|          |          |          |                                |
|  9 |          JOIN FILTER USE       |                      |            | 600037888|   1186008|     8703( 0)|    469383|          |          |          |                                |
| 10 |           PX PART ITERATOR     | DEGREE_16            |            | 600037888|   1186008|     8703( 0)|    469281|          |          |          |                                |
|*11 |            TABLE ACCESS FULL   | LINEITEM             | REGRESS    | 600037888|          |     8703( 0)|          |          |          |          |                                |
|*12 |          JOIN FILTER CREATE    |                      |            |      7453|          |   758687( 0)|          |          |          |          |                                |
|*13 |           PX N2N LOCAL         | QUEUE_1              |            |      7453|        34|   758687( 0)|   4729157|          |          |          |                                |
|*14 |            HASH JOIN INNER     |                      |            |      7453|        36|   758687( 0)|   4701786|          |          |          |                                |
| 15 |             JOIN FILTER USE    |                      |            |  15000000|      1067|      168( 0)|     11596|          |          |          |                                |
| 16 |              PX PART ITERATOR  | DEGREE_16            |            |  15000000|      1067|      168( 0)|     11589|          |          |          |                                |
|*17 |               TABLE ACCESS FULL| CUSTOMER             | REGRESS    |  15000000|          |      168( 0)|          |          |          |          |                                |
|*18 |             JOIN FILTER CREATE |                      |            |      7453|          |   758516( 0)|          |          |          |          |                                |
|*19 |              PX N2N LOCAL      | QUEUE_2              |            |      7453|        36|   758516( 0)|   4689871|          |          |          |                                |
|*20 |               HASH JOIN SEMI   |                      |            |      7453|        34|   758516( 0)|   4682625|          |          |          |                                |
| 21 |                JOIN FILTER USE |                      |            | 150000000|     14784|     1609( 0)|    118180|          |          |          |                                |
| 22 |                 PX PART ITERATOR| DEGREE_16            |            | 150000000|     14784|     1609( 0)|    118173|          |          |          |                                |
|*23 |                  TABLE ACCESS FULL| ORDERS               | REGRESS    | 150000000|          |     1609( 0)|          |          |          |          |                                |
|*24 |                JOIN FILTER CREATE|                      |            |      7198|          |   756888( 0)|          |          |          |          |                                |
| 25 |                 RESULT         |                      |            |      7198|        34|   756888( 0)|   4563947|          |          |          |                                |
|*26 |                  HASH GROUP    |                      |            |      7198|        34|   756888( 0)|   4563862|          |          |          |                                |
| 27 |                   PX PART ITERATOR| DEGREE_16            |            | 600037888|  37502313|     8703( 0)|     63642|          |          |          |                                |
| 28 |                    TABLE ACCESS FULL| LINEITEM             | REGRESS    | 600037888|          |     8703( 0)|          |          |          |          |                                |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
语句大部分时间都是在执行最下面的hash group

- 不同参数下的性能：
- 1.
alter system set columnar_vm_buffer_size=1G scope=memory;
alter system set columnar_material_percent=40 scope=memory;
alter system set columnar_max_operator_mem_percent=60 scope=memory;
Elapsed: 00:02:38.122

- 2.
alter system set columnar_vm_buffer_size=800M scope=memory;
alter system set columnar_material_percent=40 scope=memory;
alter system set columnar_max_operator_mem_percent=60 scope=memory;
15.670
Elapsed: 00:05:28.287

autotrace信息：
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | E - Rows | A - Rows | Cost(%CPU)  | A - Time | Loops    | Memory   | Disk     | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |          |             |          |          |          |          |                                |
|  1 |  COL TO ROW                    |                      |            |       100|          |   767464( 0)|          |          |          |          |                                |
|  2 |   WINDOW                       |                      |            |       100|       100|   767464( 0)| 336795283|          |          |          |                                |
|  3 |    PX COORDINATOR              |                      |            |          |       612|             | 336795268|          |          |          |                                |
|  4 |     PX N2I LOCAL               | QUEUE_0              |            |       100|       612|   767464( 0)| 336795266|          |          |          |                                |
|  5 |      WINDOW                    |                      |            |       100|        31|   767462( 0)| 336794687|          |          |          |                                |
|  6 |       TOP SORT                 |                      |            |     29814|        31|   767462( 0)| 336794680|          |          |          |                                |
|  7 |        HASH GROUP              |                      |            |     29814|        31|   767461( 0)| 336794650|          |          |          |                                |
|* 8 |         HASH JOIN INNER        |                      |            |     29814|       217|   767458( 0)| 336794597|          |          |          |                                |
|  9 |          JOIN FILTER USE       |                      |            | 600037888|   1186008|     8703( 0)|    468464|          |          |          |                                |
| 10 |           PX PART ITERATOR     | DEGREE_16            |            | 600037888|   1186008|     8703( 0)|    468356|          |          |          |                                |
|*11 |            TABLE ACCESS FULL   | LINEITEM             | REGRESS    | 600037888|          |     8703( 0)|          |          |          |          |                                |
|*12 |          JOIN FILTER CREATE    |                      |            |      7453|          |   758687( 0)|          |          |          |          |                                |
|*13 |           PX N2N LOCAL         | QUEUE_1              |            |      7453|        42|   758687( 0)| 336324442|          |          |          |                                |
|*14 |            HASH JOIN INNER     |                      |            |      7453|        44|   758687( 0)| 336295812|          |          |          |                                |
| 15 |             JOIN FILTER USE    |                      |            |  15000000|      8767|      168( 0)|      9540|          |          |          |                                |
| 16 |              PX PART ITERATOR  | DEGREE_16            |            |  15000000|      8767|      168( 0)|      9531|          |          |          |                                |
|*17 |               TABLE ACCESS FULL| CUSTOMER             | REGRESS    |  15000000|          |      168( 0)|          |          |          |          |                                |
|*18 |             JOIN FILTER CREATE |                      |            |      7453|          |   758516( 0)|          |          |          |          |                                |
|*19 |              PX N2N LOCAL      | QUEUE_2              |            |      7453|        44|   758516( 0)| 336284728|          |          |          |                                |
|*20 |               HASH JOIN SEMI   |                      |            |      7453|        42|   758516( 0)| 336276756|          |          |          |                                |
| 21 |                JOIN FILTER USE |                      |            | 150000000|     29712|     1609( 0)|     61778|          |          |          |                                |
| 22 |                 PX PART ITERATOR| DEGREE_16            |            | 150000000|     29712|     1609( 0)|     61769|          |          |          |                                |
|*23 |                  TABLE ACCESS FULL| ORDERS               | REGRESS    | 150000000|          |     1609( 0)|          |          |          |          |                                |
|*24 |                JOIN FILTER CREATE|                      |            |      7198|          |   756888( 0)|          |          |          |          |                                |
| 25 |                 RESULT         |                      |            |      7198|        42|   756888( 0)| 336213115|          |          |          |                                |
|*26 |                  HASH GROUP    |                      |            |      7198|        42|   756888( 0)| 336212890|          |          |          |                                |
| 27 |                   PX PART ITERATOR| DEGREE_16            |            | 600037888|  37502313|     8703( 0)|    103106|          |          |          |                                |
| 28 |                    TABLE ACCESS FULL| LINEITEM             | REGRESS    | 600037888|          |     8703( 0)|          |          |          |          |                                |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+


可以看出Hash group的性能下降非常明显
通过火焰图对内存不足的场景下的hash group进行性能分析，发现主要时间都用于batchdata的write_row

```

#####   [batch性能分析](#batch性能分析)  

- 通过使用不同分支调整参数测试tpch Q18，有以下结果


```
参数：
alter system set columnar_vm_buffer_size=640M scope=memory;
alter system set columnar_material_percent=50 scope=memory;

结果：
Elapsed: 00:03:56.547     使用distinction方式的聚合（即使用聚合中带distinct的代码逻辑）
Elapsed: 00:02:40.279     主干版本(使用分批方式)
Elapsed: 00:02:14.229     修改为使用distinction方式加整个columnset（带bitmap）写（修改distinction的物化方式为写整个columnset）
Elapsed: 00:02:12.650     使用select（增加过滤无效值）
Elapsed: 00:02:13.619     小于1/4再select（有效值小于1/4时过滤）

```

##   [2. 接口](#2-接口)  

- 暂无


##   [3. 规格与约束](#3-规格与约束)  

- Hash Group的优化目前只针对没有聚合带distinct的场景
- 不保证能达到最佳性能（即不保证和一开始执行时内存充足的性能一致）
- Hash Join进入probe阶段以后，暂时无法加速


##   [4. 特性](#4-特性)  

###   [4.1 COLUMNAR_VM_BUFFER_SIZE修改，配额参数实时生效](#41-columnar-vm-buffer-size修改配额参数实时生效)  

- 现状：


```
参数修改时，实际内存实时生效，但是配额需要等待数据库空闲时生效（即有语句正在执行时无法生效，须等所有语句执行完后执行下一条语句时生效）

```

- 规格：


```
- 配额总内存（TOTAL）由COLUMNAR_VM_BUFFER_SIZE * COLUMNAR_MATERIAL_PERCENT得出
- TOTAL仅增大可实时生效（参数值改小与原来逻辑相同）
- TOTAL修改生效时，所有已修改的列执行相关内存参数同步生效（例如COLUMNAR_MAX_OPERATOR_MEM_PERCENT等）
- 参数修改不会限制已分配的配额（例如COLUMNAR_MAX_OPERATOR_MEM变小后，如果单算子使用配额超过了最大值，其配额不会变小，但是不能分配新的配额）

```

- 方案：


```
- 修改参数时，判断如果新的TOTAL大于原来的TOTAL，更新MATERIAL_QUOTA上面的所有参数值

```

###   [4.2  Hash Group算子内存溢出场景优化](#42--hash-group算子内存溢出场景优化)  

####   [4.2.1 Hash Group重新分批](#421-hash-group重新分批)  

#####   [前置条件](#前置条件)  

- 触发前提：


```
- 当前批次为0/child节点数据未取完（两个条件等价）
    （如果当前child节点数据已取完，后续再减少批次意义不大）

```

- 触发条件


```
- 当前批次使用内存 * 批次 &lt; 配额
    （即大概率所有数据都可以放到内存中执行）
- 批次 &gt; 32(数值可调整) 并且 配额 &gt; 当前使用内存 * 8(数值可调整)
    （即批次太多，虽然无法全部内存执行，但是可以减少批次加速执行）

```

**上述触发条件满足一条即可**

- 由于数据分布不均匀时，可能会出现数据集中在同一批的场景，上述可能会出现重新分批后依旧满足重新分批触发条件，因此，我们增加如下规则：


```
- 每次分批/重新分批时，记录当前配额为X。一批数据分组完成之后尝试申请配额（有分批的场景），当前配额大于X时才进行是否重新分批的判断。

```

#####   [执行流程](#执行流程)  

（其执行流程大致上相当于对已取完的数据重新做hash group）

- 执行前准备


```
- 取出当前的所有batch（hash group分批时写入文件的数据）

```

- 批次预计算


```
- 批次 / (配额 / 当前使用内存) / 2(数值可调整)
如果上述计算值 &lt;= 1， 则不需要提前分批次
- 直接从全内存开始做，内存不足时再分批。（数据分布不均匀，并且此时的内存不一定是能分配到的最大内存，该选项可以尽量一次性做最多数据）

```

- 执行hash group


```
- 使用现有流程，对batch中的所有数据执行hash group
（执行开始前内存中的所有数据不需要重新分批，因为上述流程不会增加批次，只会减少，当前内存中数据不可能分配到其他批次）

```

- 执行结束


```
- 回归正常流程，从child节点取下一批数据执行

```

#####   [备选方案（该方案实现逻辑较为复杂，优先考虑其他方案，该方案作为后备）：](#备选方案该方案实现逻辑较为复杂优先考虑其他方案该方案作为后备)  

1. 每执行完一个columnset以后，进行如下判断：


```
- 如果没有分批，继续原有流程。
- 如果有分批，进入申请内存流程。
- 如果申请之前的内存满足条件 未使用内存（总内存 - 当前内存）&gt; （最大使用内存 * X%）.max(Y MB)，或者申请内存之后满足条件，进入减少分批流程
- 如果无法满足上述条件，继续执行原有流程

```

1. 开始批次减少流程，选择批次


```
- 批次选择原则（由于不一定能保证所有批次都一次做完，我们要尽量减少将数据读入内存后又写盘的操作）
- 首先了解分批的批次原理：
  分批时，批次数会按照2的n次扩张，计算批次方式为计算group key的hash值，取其中n位（如果批次数量为2的n次）为当前数据的批次号
- 其次我们了解批次的特征：
  由于分批是陆续进行的，而非一次扩张。因此可能会发生本来应该属于第3批的数据存放在第1批里面的情况（处理该数据的时候只有两批，后续扩到4批）。
- 根据以上特征，我们可以得出结论，第3批的数据必须跟第1批的数据一起处理
- 因此，我们可以优先选择处理第N/2批的数据（如果批次数量为N），因为该批数据只有可能是最后一次扩批时写入的，如果批次成功减少的话，该批数据在减少后一定会在内存中。

```

###   [4.3 Hash Join算子内存溢出场景优化](#43-hash-join算子内存溢出场景优化)  

####   [4.3.1 尽量避免数据和结构写盘](#431-尽量避免数据和结构写盘)  

```
当前现状：同时满足以下条件时所有数据和数组结构写盘，并且后面一直使用该模式执行
  - 内存不足
  - hash table中只有一个group或者hash table的len/group &gt; 30.(hash table的len为数据量，group为不重复的数据个数，即只有一个group或者数据重复度高)
存在问题：写盘后性能极差，执行时间长

```

我们尝试通过以下方案解决:

- 修改hash join写盘的条件，大部分场景尽量不触发写盘


```
触发hash join写盘的条件修改为：
 - 内存不足
 - hash table中只有一个group
 - 如果当前使用配额大于一定值（待定，或隐藏配置参数），等待一段时间后，无空闲内存
（当前使用配额较大时，hash join切换写盘的时间也很长，此时即使能从磁盘切换到内存中，也需要消耗大量时间，不如等待其他语句执行）

```

####   [4.3.2 hash join在写盘后，提供能切换到内存中执行的能力](#432-hash-join在写盘后提供能切换到内存中执行的能力)  

- 触发切换内存的条件：


```
- 记录写到文件中的数据大小，该部分和其他使用内存大小相加，小于当前可用内存，并且按照一定比例预留一部分内存

```

- 切换内存流程：


```
- 参考现有hash jion切换的逻辑，流程增加参数，指定向哪个方向切换。
- 在切换时，将所有写入文件的数据读入内存即可（读取时判断是否interrupt）

```

####   [4.3.3 hash join在build过程重新分批](#433-hash-join在build过程重新分批)  

- 参考4.2.1中的流程，可采用相同思路，重新做build


####   [4.3.4 other批次的优化](#434-other批次的优化)  

根据前面小节中分析出来的数据，没有other批次时的性能要比有other批次时的性能好得多，内存溢出场景下的性能差距主要来自于对other批次数据的重新分批处理。因此，我们有如下思路：

- 在处理other批次数据时，申请内存，此时仍内存不足：


```
- 假设有N个批次文件，N-1批数据放在各自的文件中，其余批次数据放在第N批的文件中
- 处理第N批数据时，前N-1批数据已经全部处理完成，第N+1批数据放在第一批文件中，以此类推，2N批以及后面的所有数据放在第N批中

- 注：该优化对只有两个批次文件的场景无优化效果

```

- 在处理other批次数据时，申请内存，此时有新的内存，满足条件：


```
- 假设有N个批次文件，N-1批数据放在各自的文件中，其余批次数据放在第N批的文件中
- 处理第N批数据时，取出所有数据，重置批次信息
- 尝试将剩余数据一次性做完（走正常流程，如果内存不足，正常扩批）

```

- 上述对other批次的优化，同样适用于hash group


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 执行TPCH Q18，将内存参数改小，确保长时间无结果返回。相同场景在开始执行后过一会改大参数，语句能尽快返回结果。
- 找一条HASH JOIN语句，内存参数改小，确认切换到了磁盘模式执行，然后改大参数，确认能切换回内存模式执行。
- 构造只有HashGroup/Join的场景，内存一开始小，后面改大，确认能尽快返回结果。
- 对于Hash Group，分别测试聚合函数带distinct和不带distinct的场景。


##   [6.资料设计章节](#6资料设计章节)  

不涉及

##   [7.未来规划](#7未来规划)  

- 根据方案中（##### batch性能分析）一节中的数据，优化hash group的分批模式
- hash join在probe阶段的性能优化后续再考虑
- 内存溢出场景下，内存参数又不能再调大时，对执行性能进行优化（考虑使用swap）


## Comments:

|  [](null)  ,逻辑批次也要有上限，100M内存1T数据做hash join会不会有问题，,hash join写盘条件修改为增加分批后数据量没有减少,对带distinct的场景确认内存统计是否有遗漏,Posted by lijiarui at 五月 11, 2024 10:47|
|---|
