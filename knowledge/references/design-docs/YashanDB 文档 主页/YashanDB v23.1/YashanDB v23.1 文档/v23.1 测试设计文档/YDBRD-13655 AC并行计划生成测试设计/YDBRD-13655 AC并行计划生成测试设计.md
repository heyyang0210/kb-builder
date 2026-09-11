Created by 张地强, last modified by  施新华 on 十一月 14, 2023

# **1. 概述**

测试使用AC时能选择并行计划以提升性能。

SR：    [YDBRD-13655](https://jira.yasdb.com/browse/YDBRD-13655?src=confmacro)    -  AC并行计划生成  完成

# **2. 需求分析**

**2.1 详细需求分析**

当用户指定并行度时，优化器会检查是否能走并行计划，当能并行时生成并行算子并加入计划搜索空间中。

- 并行是通过多线程实现
- 并行的设置可通过 hint指定或设置配置参数，如:


```
   （1）select /*+parallel(t1,2) */ * from t1;   --即是对表进行并行度为2的扫描

   （2）alter session set degree_of_parallel = 2;

```

生成计划如下

```
SQL&gt; explain select /<span class="hljs-emphasis">*+parallel(AC_SCAN_TABLE_PARALLEL,4)*</span>/ t1 from AC<span class="hljs-emphasis">_SCAN_</span>TABLE_PARALLEL order by 1;

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 3970803982                                      
Optimizer: ADOPT_C                                              
<span class="hljs-code" style="color: rgb(57,115,0);">                                                                </span>
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  COL TO ROW                    |                      |            |          |             |                                |
|  2 |   EXPAND                       |                      |            |    200000|    47535( 0)|                                |
|  3 |    SORT ORDER BY               |                      |            |    100000|    47524( 0)|                                |
|  4 |     PX COORDINATOR             |                      |            |          |             |                                |
|  5 |      PX N2I LOCAL              | QUEUE_0              |            |    100000|      436( 0)|                                |
|  6 |       AC SCAN                  | AC<span class="hljs-emphasis">_SCAN_</span>AC_PARALLEL  | REGRESS    |    100000|       97( 0)|                                |
|  7 |       TABLE ACCESS FULL        | AC<span class="hljs-emphasis">_SCAN_</span>TABLE_PARALLEL| REGRESS    |    100000|      110( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
<span class="hljs-code" style="color: rgb(57,115,0);">                                                                </span>
Operation Information (identified by operation id):             
---------------------------------------------------             
<span class="hljs-code" style="color: rgb(57,115,0);">                                                                </span>
   1 - Projection: RemoteTable[<span class="hljs-string" style="color: rgb(136,0,0);">1</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">INTEGER</span>]                      
   2 - Projection: Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 0</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">INTEGER</span>]                         
   3 - Projection: Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 0</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">INTEGER</span>], Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 1</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">BIGINT</span>]    
   4 - Projection: Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 0</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">INTEGER</span>], Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 1</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">BIGINT</span>]    
   5 - Projection: Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 0</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">INTEGER</span>], Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 1</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">BIGINT</span>]    
<span class="hljs-code" style="color: rgb(57,115,0);">       PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 4-&gt;1 DEGREE_4,PART_0)</span>
   6 - Projection: Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 0</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">INTEGER</span>], Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 1</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">BIGINT</span>]    
   7 - Projection: Tuple[<span class="hljs-string" style="color: rgb(136,0,0);">0, 0</span>][<span class="hljs-symbol" style="color: rgb(188,96,96);">INTEGER</span>], 1[BIGINT]              

27 rows fetched.


```

- 并行度设置值小于2时，就是非并行执行；并行度最高设置255，高于255也按255处理
- 线程个数由MAX_PARALLEL_WORKERS参数控制，默认为32；因此当并行度高于32时，实际可用的线程个数只有32；当存在多个stage时，多个stage目前是平分线程
- 全表扫跟全索引扫的并行在sender使用测使用sender random，然后发送给coordinater进行汇总读取后输出，所以是 n -> 1


### 2.2 规格约束

1. 本方案当前只支持单机并行，待分布式适配后天然支持分布式下并行。
1. 规格上AC SCAN与TABLE FULL SCAN在并行上保持一致。
1. 当前并行都只考虑资源充足的情况进行，资源不足的在该SR暂不涉及；不足的有专门的IR跟踪：    [https://jira.yasdb.com/browse/YDBRD-12255](https://jira.yasdb.com/browse/YDBRD-12255)  
1. 并行一般情况下都能提升执行效率，但是也有可能降低（在数据分布不均匀，都在一个线程做时，其余线程在访问完空表之后进行空等）
1. 设置的并行度只是一个参考值，实际受MAX_PARALLEL_WORKERS参数影响


# **3. 测试**  **设计方法**   

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

# 4.   **详细测试设计**

使用现有用例进行测试。

1. 直接查询ac和改写ac都能走并行
1. 已有用例开启并行后结果正确性
1. 开启并行后，explain查看计划，是否有px算子，有即说明走了并行。
1. 重点关注join、聚合、groupby场景下是否结果正确。可参考已有非并行用例打开并行后执行结果，理论上结果完全一致且计划上增加了px计划。


# 5.   **测试用例**

# 6.   **测试框架设计**

本次测试采用yasft测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
,  
|


## Attachments:

[文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTA4OTcwYzJhZjRmNTFmOTFmIiwicmVmX2lkIjoiNjczOTY5OTA1OTNmOTljOWZmMjM0ZmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3Mjc2LCJleHAiOjE3ODIyOTM2NzZ9.Jq5NCasHURthjsTkg50HFW9OsgRVpos6qeDdgw3HUlw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
