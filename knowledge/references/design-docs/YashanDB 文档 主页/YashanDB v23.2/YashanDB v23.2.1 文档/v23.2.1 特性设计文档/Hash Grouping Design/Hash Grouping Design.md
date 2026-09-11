Created by 李嘉瑞, last modified on 十一月 28, 2023

#   [YDBRD-21510 : Hash Grouping Design（Hash Grouping方案设计）](#ydbrd-21510--hash-grouping-designhash-grouping方案设计)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-21510](https://jira.yasdb.com/browse/YDBRD-21510)  

##   [1. Overview（概述）](#1-overview概述)  

- 该需求主要来源于TPC-DS中使用了rollup相关语法，需要支持grouping的执行，以及一些相关函数。
- hash grouping主要功能类似于多个分组聚合数据的汇总,其语法主要包括  **grouping sets, rollup, cube**  ，需要实现的函数包括：  **grouping,grouping_id,group_id**  。
- grouping sets：其用法例如  **group by grouping sets(a,b)**  ，其相当于  **group by a和group by b数据的集合**  （group by a时b列填空，group by b时a列填空，下同）。
- rollup：其用法例如  **group by rollup(a,b)**  ，其相当于  **group by a，b，group by a, group by null的集合**  （group by null实际上就是对所有数据不分组做聚合，分组列填空，使用group by null方便表示）。  **rollup(a,b)<=>grouping sets((a,b),a,null)**  .
- cube：其用法例如  **group by cube(a,b)**  ，其相当于  **group by a,b , group by a, group by b, group by null的集合**  。  **cube(a,b)<=>grouping sets((a,b),a,b,null)**  .
- grouping函数参考：    [https://conf.yasdb.com/display/YAS/Grouping+Grouping_Id+Group_Id+Analyse](https://conf.yasdb.com/display/YAS/Grouping+Grouping_Id+Group_Id+Analyse)  
- starrocks官方TPC-DS语句：    [https://docs.starrocks.io/zh-cn/latest/benchmarking/tpc_ds_99_sql](https://docs.starrocks.io/zh-cn/latest/benchmarking/tpc_ds_99_sql)  


##   [2. Features（功能特性）](#2-features功能特性)  

- 示例说明(Oracle 21C)：


```
SQL&gt; select * from t;

	 A	    B	       C	  D	     E
---------- ---------- ---------- ---------- ----------
	 1	    2	       3	  4	     5
	 1	    3	       4	 10	    12

SQL&gt; select a,b,c,sum(d),grouping_id(a,b,c) from t group by grouping sets((a,b),(a,c));

	 A	    B	       C     SUM(D) GROUPING_ID(A,B,C)
---------- ---------- ---------- ---------- ------------------
	 1		       4	 10		     2
	 1		       3	  4		     2
	 1	    2			  4		     1
	 1	    3			 10		     1

SQL&gt; select a,b,c,sum(d),grouping_id(a,b,c) from t group by rollup(a,b,c);

	 A	    B	       C     SUM(D) GROUPING_ID(A,B,C)
---------- ---------- ---------- ---------- ------------------
	 1	    2	       3	  4		     0
	 1	    3	       4	 10		     0
	 1	    2			  4		     1
	 1	    3			 10		     1
	 1				 14		     3
					 14		     7

6 rows selected.

```

- 用法示例：


```
select projection from table group by grouping sets(columns);
select projection from table group by rollup(columns);
select projection from table group by cube(columns);

```

上面是hash grouping的一般用法，projection中可以包含分组列和聚合函数，projection中的列可以包含后面分组列中的任意一列

- SQL语句示例：


```
select a, b, sum(c) from t group by grouping sets(a, b);
select a, b, sum(c) from t group by rollup(a, b);
select a, b, sum(c) from t group by cube(a, b);
select a, b, c, d from t group by grouping sets(a, b), rollup(c, d);

```

##   [3. Survey（starrocks调研）](#3-surveystarrocks调研)  

starrocks建表语句：

```
create table t(a int, b int, c int, d int,e int) distributed by hash(a) buckets 10 properties("replication_num"="1");

```

- starrocks执行计划：


```
MySQL [starrocks]&gt; explain select sum(a),b,c,d,e from t group by grouping sets((b,c),(d,e));
+-----------------------------------------------------------------------------+
| Explain String                                                              |
+-----------------------------------------------------------------------------+
| PLAN FRAGMENT 0                                                             |
|  OUTPUT EXPRS:6: sum | 2: b | 3: c | 4: d | 5: e                            |
|   PARTITION: UNPARTITIONED                                                  |
|                                                                             |
|   RESULT SINK                                                               |
|                                                                             |
|   6:EXCHANGE                                                                |
|                                                                             |
| PLAN FRAGMENT 1                                                             |
|  OUTPUT EXPRS:                                                              |
|   PARTITION: HASH_PARTITIONED: 2: b, 3: c, 4: d, 5: e, 7: GROUPING_ID       |
|                                                                             |
|   STREAM DATA SINK                                                          |
|     EXCHANGE ID: 06                                                         |
|     UNPARTITIONED                                                           |
|                                                                             |
|   5:Project                                                                 |
|   |  &lt;slot 2&gt; : 2: b                                                        |
|   |  &lt;slot 3&gt; : 3: c                                                        |
|   |  &lt;slot 4&gt; : 4: d                                                        |
|   |  &lt;slot 5&gt; : 5: e                                                        |
|   |  &lt;slot 6&gt; : 6: sum                                                      |
|   |                                                                         |
|   4:AGGREGATE (merge finalize)                                              |
|   |  output: sum(6: sum)                                                    |
|   |  group by: 2: b, 3: c, 4: d, 5: e, 7: GROUPING_ID                       |
|   |                                                                         |
|   3:EXCHANGE                                                                |
|                                                                             |
| PLAN FRAGMENT 2                                                             |
|  OUTPUT EXPRS:                                                              |
|   PARTITION: RANDOM                                                         |
|                                                                             |
|   STREAM DATA SINK                                                          |
|     EXCHANGE ID: 03                                                         |
|     HASH_PARTITIONED: 2: b, 3: c, 4: d, 5: e, 7: GROUPING_ID                |
|                                                                             |
|   2:AGGREGATE (update serialize)                                            |
|   |  STREAMING                                                              |
|   |  output: sum(1: a)                                                      |
|   |  group by: 2: b, 3: c, 4: d, 5: e, 7: GROUPING_ID                       |
|   |                                                                         |
|   1:REPEAT_NODE                                                             |
|   |  repeat: repeat 1 lines [[2, 3], [4, 5]]                                |
|   |                                                                         |
|   0:OlapScanNode                                                            |
|      TABLE: t                                                               |
|      PREAGGREGATION: ON                                                     |
|      partitions=1/1                                                         |
|      rollup: t                                                              |
|      tabletRatio=10/10                                                      |
|      tabletList=11486,11488,11490,11492,11494,11496,11498,11500,11502,11504 |
|      cardinality=2                                                          |
|      avgRowSize=5.0                                                         |
|      numNodes=0                                                             |
+-----------------------------------------------------------------------------+

```

starrocks没有专门用来做grouping的算子，通过  **REPEAT_NODE**  算子，将数据拷贝多份，增加grouping_id列并将对应的列置为null，在上层直接对所有的group列和grouping_id列一起做hash group实现。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 需要优化器将rollup和cube拆分。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 总体思路](#51-总体思路)  

hash grouping的数据特征类似于将多个hash group的结果组合在一起，其最终结果也可以通过将多个hash group的结果填充null列后合并得到。因此我们可以通过创建多个HashGroupAggContext对不同的grouping sets分别做hash group实现。

###   [5.2 执行流程](#52-执行流程)  

- **执行前：rollup和cube需要由优化器根据规则拆成多个grouping set。**
- **遍历grouping sets，获取以下初始化信息：**
    - 所有的grouping列位置以及grouping列的schema
    - 每一个grouping set中的列与最终位置的映射关系
    - 创建一个全为null值包含所有grouping列的column数组
- **为每一个grouping set创建一个HashGroupAggContext**
- **从child拿一个columnset，分别push到每一个HashGroupAggContext中做hash group。**
- **push的时候需要考虑内存使用情况，当前的hash group有两套配额管理方式（带distinction的和不带distinction的，分别采用两套流程）**
    - 是否直接使用一套带distinction的流程？
    - 所有HashGroupAggContext共用配额，每一个使用配额的一部分，按照grouping列的个数决定每一个HashGroupAggContext可以使用多少配额。
    - 如果优化器提供了每一个grouping set有多少组数据，可以根据每一个grouping set占总数据的比例分配配额(优化器暂时无法提供)
- **所有的数据都做完hash group以后，进入以下流程获取最终column set**
    - 遍历所有的HashGroupAggContext，获取单个hash group的结果
    - 使用初始化的空column数组，根据映射关系将其中不为空的列替换为上一步获取到的结果
    - 添加聚合函数列和grouping_id列（如果有）
- **一批数据做完以后，根据分批流程判断是否有下一批数据，并继续执行上述步骤，直到所有数据做完**


###   [5.3 分布式分发](#53-分布式分发)  

- **TPC-DS数据特征（1G）：**


```
rollup第一列分布：
query 5: channel数据：（ 6 659 15）
query 70: s_state数据：（只有一种，540754条）
query 77: channel数据：（6，20，30）
query 80: channel数据： （6，404，15）

```

以上是从含有rollup的11条语句中摘取出数据较不均衡的几条语句，其他语句按照rollup第一列分布都比较均衡。

- **TPC-DS  100G数据**


```
query 5: channel数据：（201 2360 12）
query 14：51564条，无重复组
query 18：138626条，group之前总数据138811条
qeury 22：101922条，group之前总数据79560000条
query 27: 61638条，group之前总数据94699条
query 36：176条，group之前总数据6639097条
query 67：47168074条，group之前总数据53990073条
query 70: 10条，group之前总数据53715515条
s_state数据：（有9种，比较均衡）
+---------+----------+
| s_state | count(*) |
+---------+----------+
| LA      |  6741334 |
| OH      |  5901508 |
| MI      |  5913220 |
| GA      |  4304024 |
| TN      |  6711914 |
| SD      |  7786494 |
| AL      |  5361757 |
| MO      |  3750585 |
| SC      |  7244679 |
+---------+----------+
9 rows in set (1.12 sec)
query 77：1237条，group之前总数据1557条
query 80：965条，group之前总数据965条
query 86：182条，group之前总数据14460229条

```

- **两阶段考量：**  由于rollup一定有一行汇总行，因此无法直接通过一阶段分发完全处理（cube无法分发？）。考虑如下场景：


```
MySQL [starrocks]&gt; select * from t;
+------+------+------+------+------+
| a    | b    | c    | d    | e    |
+------+------+------+------+------+
| NULL | NULL | NULL | NULL |    1 |
| NULL |    1 | NULL |    1 |    1 |
+------+------+------+------+------+
2 rows in set (0.07 sec)

MySQL [starrocks]&gt; select a,b,c,grouping(a,b,c),count(*) from t group by rollup(a,b,c);
+------+------+------+-------------------+----------+
| a    | b    | c    | grouping(a, b, c) | count(*) |
+------+------+------+-------------------+----------+
| NULL | NULL | NULL |                 3 |        2 |
| NULL | NULL | NULL |                 7 |        2 |
| NULL | NULL | NULL |                 0 |        1 |
| NULL |    1 | NULL |                 0 |        1 |
| NULL | NULL | NULL |                 1 |        1 |
| NULL |    1 | NULL |                 1 |        1 |
+------+------+------+-------------------+----------+
6 rows in set (0.05 sec)

MySQL [starrocks]&gt; select a,b,grouping_id(a,b) from t group by grouping sets((a,b),(a,b));
+------+------+----------------+
| a    | b    | grouping(a, b) |
+------+------+----------------+
| NULL |    1 |              0 |
| NULL | NULL |              0 |
| NULL |    1 |              0 |
| NULL | NULL |              0 |
+------+------+----------------+
4 rows in set (0.03 sec)

```

- 考量点1：rollup/cube场景一定不能通过一阶段DN直接处理，部分grouping sets可以，例如：grouping set((a,b),(a,c))。
- 考量点2：不能一阶段执行的场景下发到DN，两阶段如何实现。
- 考量点3：两阶段第二阶段如何实现，对第一阶段有什么要求。


**两阶段思路：**

- **思路一**  （可分发可不分发）  **（优化器方案采用该思路）**


```
    采取与starrocks类似的逻辑，在第一阶段增加grouping_id列，第二阶段使用普通的hash group算子，
将所有的grouping列和grouping_id列（grouping_id的参数是所有grouping列（去掉重复列），下面提到grouping_id列相同），再加上group id列,作为第二阶段的分组列。
distinct：当聚合函数中使用了distinct时，无法在第一阶段做聚合，因此第一阶段需要将distinct的列加到所有的grouping sets中。

需要考虑如下：
    1.第二阶段要求第一阶段生成grouping_id列和group_id列，执行第二阶段不需要感知哪一列是grouping_id列
    2.由于第二阶段只是普通的hash group，因此第二阶段可以分发到不同节点去做

两阶段增加隐藏列规则：
    1.只要是两阶段，第一阶段的hash grouping就必须增加grouping_id列，其参数为所有grouping sets列的集合。
    2.如果最终生成的grouping sets中包含重复的grouping set，那么就需要增加group id列。（没有重复的grouping set的时候也可以添加，不影响正确性，只会影响性能）
    3.第二阶段使用所有的grouping列和第一阶段生成grouping_id列作为group by列

```

- **思路二**  （可以分发的场景（天马行空））


```
对于rollup(x,y,……)，除最后一行汇总行以外，其他行均可通过以x为分发key一阶段得到最终结果，因此，有如下思路：
- 1.判断x是否为分布键，不是则以x为分发key分发
- 2.第一阶段正常执行hash grouping，同时生成grouping_id列
- 3.第二阶段使用一个新的算子(RollupMerge)，如果是非汇总行（通过grouping_id列是否为0判断）直接返回，否则传入聚合器计算两阶段聚合结果

需要考虑如下：
    1.该思路采用分发策略后效率可能较高，但实现可能较复杂
    2.执行需要实现新的算子（工作量增加）
    3.第二阶段同样要求第一阶段生成grouping_id列

```

- **思路三**  （天马行空）
- 由优化器处理，第一阶段不需要生成额外的grouping id列，将rollup的最后一个汇总行与其他分开，最后通过union all合并。


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- grouping sets/rollup/cube分别单独使用和组合使用
- 单机/分布式/并行
- grouping sets中不同grouping set没有公共列，例如（group by grouping sets((a,b),(c,d))）
- 多个grouping sets组合使用出现重复列，例如（group by grouping sets((a,b)),rollup(a,b,c)）
- 同一个grouping sets中出现完全重复列，例如（grouping sets((a,b),(a,b))）
- grouping sets中有部分列重复，例如（grouping sets((a,b),(a,c))）
- 内存不足场景
- 聚合函数中带distinct，同时有部分聚合函数不带distinct
- grouping的结果与其他表做join
- grouping sets列中包含分布键
- 以上场景带grouping等函数


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

##   [9. SR链接](#9-sr链接)  

-   [YDBRD-21510](https://jira.yasdb.com/browse/YDBRD-21510?src=confmacro)    -  列存计算支持hash grouping和并行  完成
-     [YDBRD-21511](https://jira.yasdb.com/browse/YDBRD-21511?src=confmacro)     - Jira项目不存在或者您没有查看该项目的权限。
-   [YDBRD-21715](https://jira.yasdb.com/browse/YDBRD-21715?src=confmacro)    -  GroupingSets支持DN上执行-列执行  完成


## Comments:

|  [](null)  ,Posted by lijiarui at 十月 27, 2023 15:10|
|---|
|评审方案|Hash Grouping设计文档|
|与会人|李嘉瑞、黄靖东、林博、徐晓锋、谭思宇、马士杰、刘晓旋、李凯峰|
|评审时间|2023/10/27 15:00-17:00|
|评审地点|25栋702会议室|
|评审纪要信息|- 增加两阶段添加grouping_id,group_id列规则详细说明
,- 用例中需要增加考虑grouping sets中包含分布键的场景
|
|评审是否通过|通过|


|评审方案|Hash Grouping设计文档|
|---|---|
|与会人|李嘉瑞、黄靖东、林博、徐晓锋、谭思宇、马士杰、刘晓旋、李凯峰|
|评审时间|2023/10/27 15:00-17:00|
|评审地点|25栋702会议室|
|评审纪要信息|- 增加两阶段添加grouping_id,group_id列规则详细说明
,- 用例中需要增加考虑grouping sets中包含分布键的场景
|
|评审是否通过|通过|
