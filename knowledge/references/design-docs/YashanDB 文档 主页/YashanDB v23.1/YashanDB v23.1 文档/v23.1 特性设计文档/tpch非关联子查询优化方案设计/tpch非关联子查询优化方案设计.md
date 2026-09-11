Created by 叶显昊, last modified by  林博 on 一月 19, 2024

YDBRD-14157 : tpch非关联子查询优化方案设计

SR链接：    [YDBRD-14157](https://jira.yasdb.com/browse/YDBRD-14157?src=confmacro)    -  [列存支持]TPCH非关联子查询优化  完成

##   [1. Overview（概述）](#1-overview概述)  

非关联子查询采用broadcast方式分发到需要的节点

##   [2. Features（功能特性）](#2-features功能特性)  

计划上，根据cost将非关联子查询改写成broadcast

```
-- q22
-- 并行

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 2365781242                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  RESULT                        | QUERY[1]             |            |          |             |                                |
|  2 |   MATERIAL                     |                      |            |         1|      117( 0)|                                |
|  3 |    PX I2N REMOTE               | QUEUE_7              |            |         1|      117( 0)|                                |
|  4 |     AGGREGATE                  |                      |            |         1|      117( 0)|                                |
|  5 |      PX N2I REMOTE             | QUEUE_8              |            |         1|      117( 0)|                                |
|  6 |       AGGREGATE                |                      |            |         1|      117( 0)|                                |
|  7 |        PX COORDINATOR          |                      |            |          |             |                                |
|  8 |         PX N2I LOCAL           | QUEUE_9              |            |         1|      117( 0)|                                |
|  9 |          AGGREGATE             |                      |            |         1|      117( 0)|                                |
| 10 |           PX BLOCK ITERATOR RANDOM| DEGREE_4             |            |      6650|      117( 0)|                                |
|*11 |            TABLE ACCESS FULL   | CUSTOMER             | REGRESS    |      6650|      117( 0)|                                |
| 12 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
| 13 |   COL TO ROW                   |                      |            |          |             |                                |
| 14 |    PX N2I REMOTE               | QUEUE_0              |            |      1000|     1189( 0)|                                |
| 15 |     SORT ORDER BY              |                      |            |      1000|     1188( 0)|                                |
| 16 |      HASH GROUP                |                      |            |      1000|      906( 0)|                                |
| 17 |       RESULT                   |                      |            |      6650|      906( 0)|                                |
|*18 |        PX N2N REMOTE           | QUEUE_1              |            |      6650|      905( 0)|                                |
| 19 |         PX COORDINATOR         |                      |            |          |             |                                |
| 20 |          PX N2I LOCAL          | QUEUE_2              |            |      6650|      894( 0)|                                |
|*21 |           HASH JOIN RIGHT ANTI |                      |            |      6650|      872( 0)|                                |
|*22 |            PX I2N LOCAL        | QUEUE_3              |            |    100000|      614( 0)|                                |
|*23 |             PX N2N REMOTE      | QUEUE_4              |            |    100000|      614( 0)|                                |
| 24 |              PX COORDINATOR    |                      |            |          |             |                                |
| 25 |               PX N2I LOCAL     | QUEUE_5              |            |    100000|      449( 0)|                                |
| 26 |                PX BLOCK ITERATOR RANDOM| DEGREE_4             |            |    100000|      110( 0)|                                |
| 27 |                 TABLE ACCESS FULL| ORDERS               | REGRESS    |    100000|      110( 0)|                                |
|*28 |            PX N2N LOCAL        | QUEUE_6              |            |      6650|      235( 0)|                                |
| 29 |             PX BLOCK ITERATOR RANDOM| DEGREE_4             |            |      6650|      117( 0)|                                |
|*30 |              TABLE ACCESS FULL | CUSTOMER             | REGRESS    |      6650|      117( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   1 - Projection: Tuple[0, 0]/Tuple[0, 1][FLOAT]               
   2 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
   3 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
       PX RemoteInfo: (BROADCAST SENDER -&gt; RANDOM RECEIVER : 1-&gt;5 [2]-&gt;[2][3][4][5][1])
   4 - Projection: SUM(Tuple[0, 0])[FLOAT], CAST(SUM(Tuple[0, 1]) AS BIGINT)[BIGINT]
   5 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
   6 - Projection: SUM(Tuple[0, 0])[FLOAT], CAST(SUM(Tuple[0, 1]) AS BIGINT)[BIGINT]
   7 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
   8 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
       PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 4-&gt;1 DEGREE_4,PART_0)
   9 - Projection: SUM(Tuple[0, 0])[FLOAT], COUNT(Tuple[0, 0])[BIGINT]
  10 - Projection: Tuple[0, 0][FLOAT]                           
  11 - Projection: Tuple[0, 5][FLOAT]                           
       Predicate : filter(SUBSTR(Tuple[0, 4], 1, 2) IN ('13', '31', '23', '29', '30', '18', '17') AND Tuple[0, 5] &gt; 0)
  13 - Projection: RemoteTable[1][BIGINT], RemoteTable[1][FLOAT], RemoteTable[1][VARCHAR, 15]
  14 - Projection: Tuple[0, 0][BIGINT], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
       PX RemoteInfo: (RANDOM SENDER -&gt; SORT RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
  15 - Projection: Tuple[0, 0][BIGINT], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
  16 - Projection: COUNT(1)[BIGINT], SUM(Tuple[0, 0])[FLOAT], Tuple[0, 1][VARCHAR, 15]
       Group Expression: (Tuple[0, 1])                          
  17 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][VARCHAR, 15] 
  18 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][VARCHAR, 15] 
       PX RemoteInfo: (HASH SENDER -&gt; RANDOM RECEIVER : 3-&gt;3 [3][4][5]-&gt;[3][4][5])
       Predicate : access(Tuple[0, 1])                          
  19 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][VARCHAR, 15] 
  20 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][VARCHAR, 15] 
       PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 4-&gt;1 DEGREE_4,PART_0)
  21 - Projection: Tuple[1, 1][FLOAT], Tuple[1, 2][VARCHAR, 15] 
       Predicate : access(Tuple[0, 0] = Tuple[1, 0, 0])         
  22 - Projection: Tuple[0, 0][INTEGER]                         
       PX LocalInfo: (HASH SENDER -&gt; RANDOM RECEIVER : 1-&gt;4 DEGREE_1,PART_0)
       Predicate : access(Tuple[0, 0])                          
  23 - Projection: Tuple[0, 0][INTEGER]                         
       PX RemoteInfo: (HASH SENDER -&gt; RANDOM RECEIVER : 3-&gt;3 [3][4][5]-&gt;[3][4][5])
       Predicate : access(Tuple[0, 0])                          
  24 - Projection: Tuple[0, 0][INTEGER]                         
  25 - Projection: Tuple[0, 0][INTEGER]                         
       PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 4-&gt;1 DEGREE_4,PART_0)
  26 - Projection: Tuple[0, 0][INTEGER]                         
  27 - Projection: Tuple[0, 1][INTEGER]                         
  28 - Projection: Tuple[0, 0, 0][INTEGER], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
       PX LocalInfo: (HASH SENDER -&gt; RANDOM RECEIVER : 4-&gt;4 DEGREE_4,PART_0)
       Predicate : access(Tuple[0, 0, 0])                       
  29 - Projection: Tuple[0, 0, 0][INTEGER], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
  30 - Projection: Tuple[0, 0, 0][INTEGER], Tuple[0, 5][FLOAT], SUBSTR(Tuple[0, 4], 1, 2)[VARCHAR, 15]
       Predicate : filter(SUBSTR(Tuple[0, 4], 1, 2) IN ('13', '31', '23', '29', '30', '18', '17') AND Tuple[0, 5] &gt; QUERY[1])
                                                                

```

```
-- q22
-- 不加并行

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 2365781242                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  RESULT                        | QUERY[1]             |            |          |             |                                |
|  2 |   MATERIAL                     |                      |            |         1|      471( 0)|                                |
|  3 |    PX I2N REMOTE               | QUEUE_3              |            |         1|      471( 0)|                                |
|  4 |     AGGREGATE                  |                      |            |         1|      471( 0)|                                |
|  5 |      PX N2I REMOTE             | QUEUE_4              |            |         1|      471( 0)|                                |
|  6 |       AGGREGATE                |                      |            |         1|      471( 0)|                                |
|  7 |        PART SCAN ALL           |                      |            |      6650|      471( 0)| [0,0]                          |
|* 8 |         TABLE ACCESS FULL      | CUSTOMER             | REGRESS    |      6650|      471( 0)|                                |
|  9 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
| 10 |   COL TO ROW                   |                      |            |          |             |                                |
| 11 |    PX N2I REMOTE               | QUEUE_0              |            |      1000|     1931( 0)|                                |
| 12 |     SORT ORDER BY              |                      |            |      1000|     1930( 0)|                                |
| 13 |      HASH GROUP                |                      |            |      1000|     1648( 0)|                                |
| 14 |       RESULT                   |                      |            |      6650|     1648( 0)|                                |
|*15 |        PX N2N REMOTE           | QUEUE_1              |            |      6650|     1647( 0)|                                |
|*16 |         HASH JOIN RIGHT ANTI   |                      |            |      6650|     1636( 0)|                                |
|*17 |          PX N2N REMOTE         | QUEUE_2              |            |    100000|      606( 0)|                                |
| 18 |           PART SCAN ALL        |                      |            |    100000|      442( 0)| [0,0]                          |
| 19 |            TABLE ACCESS FULL   | ORDERS               | REGRESS    |    100000|      442( 0)|                                |
| 20 |          PART SCAN ALL         |                      |            |      6650|      943( 0)| [0,0]                          |
|*21 |           TABLE ACCESS FULL    | CUSTOMER             | REGRESS    |      6650|      943( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   1 - Projection: Tuple[0, 0]/Tuple[0, 1][FLOAT]               
   2 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
   3 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
       PX RemoteInfo: (BROADCAST SENDER -&gt; RANDOM RECEIVER : 1-&gt;5 [2]-&gt;[2][3][4][5][1])
   4 - Projection: SUM(Tuple[0, 0])[FLOAT], CAST(SUM(Tuple[0, 1]) AS BIGINT)[BIGINT]
   5 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
   6 - Projection: SUM(Tuple[0, 0])[FLOAT], COUNT(Tuple[0, 0])[BIGINT]
   7 - Projection: Tuple[0, 0][FLOAT]                           
   8 - Projection: Tuple[0, 5][FLOAT]                           
       Predicate : filter(Tuple[0, 5] &gt; 0 AND SUBSTR(Tuple[0, 4], 1, 2) IN ('13', '31', '23', '29', '30', '18', '17'))
  10 - Projection: RemoteTable[1][BIGINT], RemoteTable[1][FLOAT], RemoteTable[1][VARCHAR, 15]
  11 - Projection: Tuple[0, 0][BIGINT], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
       PX RemoteInfo: (RANDOM SENDER -&gt; SORT RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
  12 - Projection: Tuple[0, 0][BIGINT], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
  13 - Projection: COUNT(1)[BIGINT], SUM(Tuple[0, 0])[FLOAT], Tuple[0, 1][VARCHAR, 15]
       Group Expression: (Tuple[0, 1])                          
  14 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][VARCHAR, 15] 
  15 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][VARCHAR, 15] 
       PX RemoteInfo: (HASH SENDER -&gt; RANDOM RECEIVER : 3-&gt;3 [3][4][5]-&gt;[3][4][5])
       Predicate : access(Tuple[0, 1])                          
  16 - Projection: Tuple[1, 1][FLOAT], Tuple[1, 2][VARCHAR, 15] 
       Predicate : access(Tuple[0, 0] = Tuple[1, 0, 1])         
  17 - Projection: Tuple[0, 0][INTEGER]                         
       PX RemoteInfo: (HASH SENDER -&gt; RANDOM RECEIVER : 3-&gt;3 [3][4][5]-&gt;[3][4][5])
       Predicate : access(Tuple[0, 0])                          
  18 - Projection: Tuple[0, 0][INTEGER]                         
  19 - Projection: Tuple[0, 1][INTEGER]                         
  20 - Projection: Tuple[0, 0, 1][INTEGER], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
  21 - Projection: Tuple[0, 0, 1][INTEGER], Tuple[0, 5][FLOAT], SUBSTR(Tuple[0, 4], 1, 2)[VARCHAR, 15]
       Predicate : filter(SUBSTR(Tuple[0, 4], 1, 2) IN ('13', '31', '23', '29', '30', '18', '17') AND Tuple[0, 5] &gt; QUERY[1])

```

```
-- q22
-- 旧计划

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 2365781242                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  RESULT                        | QUERY[1]             |            |          |             |                                |
|  2 |   AGGREGATE                    |                      |            |         1|      117( 0)|                                |
|  3 |    MATERIAL                    |                      |            |         1|      117( 0)|                                |
|  4 |     PX N2I REMOTE              | QUEUE_4              |            |         1|      117( 0)|                                |
|  5 |      AGGREGATE                 |                      |            |         1|      117( 0)|                                |
|  6 |       PX COORDINATOR           |                      |            |          |             |                                |
|  7 |        PX N2I LOCAL            | QUEUE_5              |            |         1|      117( 0)|                                |
|  8 |         AGGREGATE              |                      |            |         1|      117( 0)|                                |
|  9 |          PX BLOCK ITERATOR RANDOM| DEGREE_4             |            |      6650|      117( 0)|                                |
|*10 |           TABLE ACCESS FULL    | CUSTOMER             | REGRESS    |      6650|      117( 0)|                                |
| 11 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
| 12 |   COL TO ROW                   |                      |            |          |             |                                |
| 13 |    GROUP                       |                      |            |       442|     1374( 0)|                                |
| 14 |     SORT ORDER BY              |                      |            |       442|     1374( 0)|                                |
| 15 |      RESULT                    |                      |            |       442|     1264( 0)|                                |
|*16 |       HASH JOIN RIGHT ANTI     |                      |            |       442|     1264( 0)|                                |
| 17 |        PX N2I REMOTE           | QUEUE_0              |            |    100000|      788( 0)|                                |
| 18 |         PX COORDINATOR         |                      |            |          |             |                                |
| 19 |          PX N2I LOCAL          | QUEUE_1              |            |    100000|      449( 0)|                                |
| 20 |           PX BLOCK ITERATOR RANDOM| DEGREE_4             |            |    100000|      110( 0)|                                |
| 21 |            TABLE ACCESS FULL   | ORDERS               | REGRESS    |    100000|      110( 0)|                                |
|*22 |        RESULT                  |                      |            |       442|      275( 0)|                                |
| 23 |         PX N2I REMOTE          | QUEUE_2              |            |      6650|      155( 0)|                                |
| 24 |          PX COORDINATOR        |                      |            |          |             |                                |
| 25 |           PX N2I LOCAL         | QUEUE_3              |            |      6650|      133( 0)|                                |
| 26 |            PX BLOCK ITERATOR RANDOM| DEGREE_4             |            |      6650|      110( 0)|                                |
| 27 |             TABLE ACCESS FULL  | CUSTOMER             | REGRESS    |      6650|      110( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   1 - Projection: Tuple[0, 0]/Tuple[0, 1][FLOAT]               
   2 - Projection: SUM(Tuple[0, 0])[FLOAT], CAST(SUM(Tuple[0, 1]) AS BIGINT)[BIGINT]
   3 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
   4 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
   5 - Projection: SUM(Tuple[0, 0])[FLOAT], CAST(SUM(Tuple[0, 1]) AS BIGINT)[BIGINT]
   6 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
   7 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][BIGINT]      
       PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 4-&gt;1 DEGREE_4,PART_0)
   8 - Projection: SUM(Tuple[0, 0])[FLOAT], COUNT(Tuple[0, 0])[BIGINT]
   9 - Projection: Tuple[0, 0][FLOAT]                           
  10 - Projection: Tuple[0, 5][FLOAT]                           
       Predicate : filter(SUBSTR(Tuple[0, 4], 1, 2) IN ('13', '31', '23', '29', '30', '18', '17') AND Tuple[0, 5] &gt; 0)
  12 - Projection: RemoteTable[1][BIGINT], RemoteTable[1][FLOAT], RemoteTable[1][VARCHAR, 15]
  13 - Projection: COUNT(1)[BIGINT], SUM(Tuple[0, 0])[FLOAT], Tuple[0, 1][VARCHAR, 15]
       Group Expression: (Tuple[0, 1])                          
  14 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][VARCHAR, 15] 
  15 - Projection: Tuple[0, 0][FLOAT], Tuple[0, 1][VARCHAR, 15] 
  16 - Projection: Tuple[1, 1][FLOAT], Tuple[1, 2][VARCHAR, 15] 
       Predicate : access(Tuple[0, 0] = Tuple[1, 0, 0])         
  17 - Projection: Tuple[0, 0][INTEGER]                         
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
  18 - Projection: Tuple[0, 0][INTEGER]                         
  19 - Projection: Tuple[0, 0][INTEGER]                         
       PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 4-&gt;1 DEGREE_4,PART_0)
  20 - Projection: Tuple[0, 0][INTEGER]                         
  21 - Projection: Tuple[0, 1][INTEGER]                         
  22 - Projection: Tuple[0, 0, 0][INTEGER], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
       Predicate : filter(Tuple[0, 2] IN ('13', '31', '23', '29', '30', '18', '17') AND Tuple[0, 1] &gt; QUERY[1])
  23 - Projection: Tuple[0, 0, 0][INTEGER], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
  24 - Projection: Tuple[0, 0, 0][INTEGER], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
  25 - Projection: Tuple[0, 0, 0][INTEGER], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
       PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 4-&gt;1 DEGREE_4,PART_0)
  26 - Projection: Tuple[0, 0, 0][INTEGER], Tuple[0, 1][FLOAT], Tuple[0, 2][VARCHAR, 15]
  27 - Projection: Tuple[0, 0, 0][INTEGER], Tuple[0, 5][FLOAT], SUBSTR(Tuple[0, 4], 1, 2)[VARCHAR, 15]

```

执行在内部增加一个算子放在子查询的第一个receiver上，增加稳定性

新算子用于从receiver中读取数据，存到channel或columnset storage中，避免发送端阻塞

|功能|设计表现|设计说明|
|---|---|---|
|receiver返回正常数据|上层返回正常数据|预期行为|
|receiver返回报错|上层返回报错，receiver退出|预期行为|
|receiver返回空|上层返回空，receiver退出|预期行为|
|上层收到中断信息|receiver退出|预期行为|


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
#[derive(Debug, Clone, PartialEq)]
pub struct BackgroundFetcher {
    child: BoxedOperator,
    operator_quota_id: usize,
}

impl BackgroundFetcher {
    #[inline]
    pub fn new(child: BoxedOperator, operator_quota_id: usize) -&gt; Self {
        Self {
            child,
            operator_quota_id,
        }
    }
}

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

```
impl Operator for BackgroundFetcher {
    ...

    #[inline]
    fn bind(&amp;self, ctx: &amp;Arc&lt;dyn Context&gt;) -&gt; Result&lt;Box&lt;dyn Cursor&gt;&gt; {
        let child = self.child.bind(ctx)?;
        let schema = child.schema().clone();
        let quota_id = self.operator_quota_id;
        let material_quota = ctx.stage_quota().get_operator_quota(quota_id)?;
        let ctx = ctx.clone();
        let (sender, receiver) = sync_channel::&lt;Result&lt;Option&lt;ColumnSet&gt;&gt;&gt;(128);
        let channel_full = Arc::new(AtomicBool::new(false));

        {
            let channel_full = channel_full.clone();
            let inner_ctx = ctx.clone();
            let spawner = ctx.task_spawner();
            spawner.spawn_with_name(
                "COL_SET_BACKGROUND_FETCHER",
                Box::new(move || {
                    let col_set_storage = ColumnSetStore::new(
                        inner_ctx.clone(),
                        child.schema().clone(),
                        material_quota,
                    );
                    let mut fetcher_storage = BackgroundFetcherStorage {
                        col_set_storage,
                        sender,
                        child,
                        channel_full,
                        ctx: inner_ctx,
                    };
                    let result = fetcher_storage.fetch();
                    if let Err(mut e) = result {
                        loop {
                            if fetcher_storage.ctx.is_interrupted() {
                                break;
                            }

                            if let Err(TrySendError::Full(Err(err))) =
                                fetcher_storage.sender.try_send(Err(e))
                            {
                                e = err;
                            } else {
                                break;
                            }
                        }
                    }
                    Box::new(EmptyTaskResult)
                }),
            )?;
        };

        Ok(Box::new(BackgroundFetcherCursor {
            receiver,
            schema,
            channel_full,
            ctx,
        }))
    }
}

impl BackgroundFetcherStorage {
    #[inline]
    fn fetch(&amp;mut self) -&gt; Result&lt;()&gt; {
        let mut col_set = None;
        let mut child_finish = false;
        loop {
            if self.ctx.is_interrupted() {
                return Err(crab::error::Error::Interrupted(
                    "fetcher is interrupted".to_string(),
                ));
            }

            if !child_finish &amp;&amp; self.channel_full.load(Ordering::SeqCst) {
                let cs = self.child.next()?;
                match cs {
                    None =&gt; {
                        child_finish = true;
                    }
                    Some(cs) =&gt; {
                        self.col_set_storage.write(cs)?;
                    }
                }
            } else {
                if col_set.is_none() {
                    col_set = self.col_set_storage.read()?;
                }
                if col_set.is_none() &amp;&amp; !child_finish {
                    col_set = self.child.next()?;
                }
                if col_set.is_none() {
                    loop {
                        if self.ctx.is_interrupted() {
                            return Err(crab::error::Error::Interrupted(
                                "fetcher is interrupted".to_string(),
                            ));
                        }

                        match self.sender.try_send(Ok(None)) {
                            Ok(_) =&gt; return Ok(()),
                            Err(e) =&gt; match e {
                                TrySendError::Full(_) =&gt; continue,
                                TrySendError::Disconnected(_) =&gt; {
                                    return Err(crab::error::Error::OperatorExecuteError(
                                        "fail to send in fetcher".to_string(),
                                    ));
                                }
                            },
                        }
                    }
                } else {
                    match self.sender.try_send(Ok(col_set)) {
                        Ok(_) =&gt; {
                            col_set = None;
                        }
                        Err(e) =&gt; match e {
                            TrySendError::Full(cs) =&gt; {
                                if let Ok(cs) = cs {
                                    col_set = cs;
                                } else {
                                    return Err(crab::error::Error::OperatorExecuteError(
                                        "unreachable in fetcher".to_string(),
                                    ));
                                }
                            }
                            TrySendError::Disconnected(_) =&gt; {
                                return Err(crab::error::Error::OperatorExecuteError(
                                    "fail to send in fetcher".to_string(),
                                ));
                            }
                        },
                    }
                }
            }
        }
    }
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 验证之前的用例
- 验证tpch
- 非关联子查询用例


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*