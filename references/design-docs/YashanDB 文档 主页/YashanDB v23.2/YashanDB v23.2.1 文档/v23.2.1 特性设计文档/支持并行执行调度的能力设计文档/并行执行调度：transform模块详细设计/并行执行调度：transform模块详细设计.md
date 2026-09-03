Created by 林俊喆, last modified by  何阳 on 一月 23, 2024

##   [1. Overview](#1-overview)  

本模块调用点于优化器生成计划之后，行执行物化改写之前。模块的输出会绑定到计划上。

如果不带并行（本地并行或者分布式并行），则会跳过这个阶段。

##   [2. Features](#2-features)  

主要对计划进行并行的适配：

1. 支持按Px划分stage
1. 支持编排stage树的执行顺序
1. 根据编排stage group规则，会在Px stage上增加Mat stage


##   [3. Detail Design](#3-detail-design)  

###   [3.1 基本流程](#31-基本流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c8ba1ad9a3311dc8b21/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQkVBQUFBQ0FBQUFBQVFBUUFBQUlBUUFRQUFoQUFBQUFBQUFBSUFBQUJBQWdBQUFBQUFBQUFBQUFBWUFBQUFBQUFnQ0FBQUNBQUFRQUFBQUJRQUFBQUlFQXdBQUFBZ0FBQUFBQUFBQUFnQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQWdBTUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE0NTMsImV4cCI6MTc4MjMxMjI1M30.7ASeADK7ga9AZ2jbINWf-Hh-HHMNZHM42ltErEBNHaQ)

输入优化后的原始算子树，经过transform处理stage、切分stage、适时增加Mat stage，生成stage树调度顺序，输出实际调度执行时的调度顺序。

####   [关键数据结构与接口](#关键数据结构与接口)  

```
// stage信息
typedef struct StPxStage {
    AnlPlan*           rootPlan; /* rootPlan should be PxSenderPlan or MatSendPlan */
    AnlPlan*           parentPlan;
    CodUint16          id;
    CodUint16          parentId;
    CodUint16          dop; /* sender or receiver dop */
    CodUint16          groupCount;
    TabQueuePortGroup* portGroups; /* stage instances on nodes */
    ObjectArray*       dependStages; /* only used when transform */
    ExecResDecl*       resDecl;

    ObjectArray*       childStages;
    union {
        CodUint16 stageFlag;
        struct {
            CodUint16 hasScanOp: 1;
            CodUint16 hasMat: 1;
            CodUint16 isRoot: 1;
            CodUint16 isUsed: 1;
            CodUint16 hasRuntime: 1;
            CodUint16 reserved: 11;
        };
    };

    CodUint16          brotherId;
    CodUint16          recvQueueCount;
    TabQueueId*        recvQueueIds;
} PxStage;

// stage group，一次调度执行的stage
typedef struct StPxStageGroup {
    ObjectArray* stages;  /* item PxStage */
    CodUint16    minReserveMem;
    CodUint16    maxReserveMem;
} PxStageGroup;

// 并行调度逻辑计划的汇总信息

typedef struct StPxDecl {
    ObjectArray* queueAttrs;
    ObjectArray* stages;       /* item PxStage */
    ObjectArray* rangePlans;
    ObjectArray* stageGroups;  /* 新增 item PxStageGroup */
    CodUint16    maxWorkerCount; /* 新增 MAX_WORKERS_PER_EXEC * Dop */
    CodUint16    minWorkerCount; /* M新增 AX_WORKERS_PER_EXEC * 1*/
    CodUint16    maxWorkersPerExec; /* 切分stage步长 */

    /* todo: will be removed */
    CodUint16    maxDop;       /* the sum of dop of all stages */
    CodUint16    rootQueueCount;
    CodUint16    reserved[2];
    TabQueueId*  rootQueueIds;
} PxDecl;

typedef struct StDstbCoordPlan {
    AnlPlan*     child;
    ObjectArray* exprs;
    PxDecl*      pxDecl;
    ObjectArray* rootStages;
    ObjectArray* subCoordPlans;
    GroupDesc    groupDesc;
    GroupDesc*   dmlGroupDesc;
    PxStage*     stage;     /// 新增 dn: stage = NULL cn: stage != NULL
    CodUint16    dmlGroupCount;
    CodUint16    totalDop;
    CodUint16    groupId;
    CodUint16    resId;
    CodBool      isMaster;
    CodBool      isCluster;
    CodUint8     unused[6];
} DstbCoordPlan;


/* transform模块入口函数： */
CodResult transformPlan(AnlOptimizer* optmzr, AnlPlan* plan);


```

###   [3.2 Stage预处理](#32-stage预处理)  

- Runtime算子所在的stage标识为hasRuntime


####   [关键数据结构与接口](#关键数据结构与接口-1)  

```
/* 被transformPlan调用 */
/* 遍历算子树，预处理stage &amp; 切分执行计划树，生成stage树 */
static CodResult walkPlan(AnlWalker* walker, AnlPlan* plan);
 

```

###   [3.3 切分执行计划树，生成stage树](#33-切分执行计划树生成stage树)  

- 遍历执行计划树，根据px_sender算子，切分生成不同的stage（hasMat 表示是否输出到物化区，hasScanOp 表示是否有表扫描，isRoot 表示是否是根stage，是否有子查询及子查询信息），如下图所示：


![](https://pingcode.yasdb.com/atlas/files/public/67396c8ba1ad9a3311dc8b22/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQkVBQUFBQ0FBQUFBQVFBUUFBQUlBUUFRQUFoQUFBQUFBQUFBSUFBQUJBQWdBQUFBQUFBQUFBQUFBWUFBQUFBQUFnQ0FBQUNBQUFRQUFBQUJRQUFBQUlFQXdBQUFBZ0FBQUFBQUFBQUFnQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQWdBTUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE0NTMsImV4cCI6MTc4MjMxMjI1M30.7ASeADK7ga9AZ2jbINWf-Hh-HHMNZHM42ltErEBNHaQ)

####   [关键数据结构与接口](#关键数据结构与接口-2)  

```
/* 被walkPlan调用 */
/*  切分执行计划树，生成stage树 */
static CodResult trsfAddStageTree();


```

###   [3.4 生成stage调度顺序](#34-生成stage调度顺序)  

####   [拉平stage树为stage数组（确定调度顺序）](#拉平stage树为stage数组确定调度顺序)  

- 规则1：按后序遍历拉平stage树为stage数组
- 规则2：碰到子查询，需要递归进入子查询，将子查询的stage树按规则1加入到全局的stage数组中


![](https://pingcode.yasdb.com/atlas/files/public/67396c8b8970c2af4f520cb2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQkVBQUFBQ0FBQUFBQVFBUUFBQUlBUUFRQUFoQUFBQUFBQUFBSUFBQUJBQWdBQUFBQUFBQUFBQUFBWUFBQUFBQUFnQ0FBQUNBQUFRQUFBQUJRQUFBQUlFQXdBQUFBZ0FBQUFBQUFBQUFnQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQWdBTUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE0NTMsImV4cCI6MTc4MjMxMjI1M30.7ASeADK7ga9AZ2jbINWf-Hh-HHMNZHM42ltErEBNHaQ)

####   [按每个stage组最大需求worker数切分出多个stage组](#按每个stage组最大需求worker数切分出多个stage组)  

#####   [stage组](#stage组)  

- 执行时调度的最小单元


#####   [每个stage组最大需求worker数（max_workers_per_exec）](#每个stage组最大需求worker数max-workers-per-exec)  

- 增加配置项（会话级）MAX_WORKERS_PER_EXEC，以及hint
- 默认max_workers_per_exec为8
- max_workers_per_exec的值根据hint与max_workers_per_exec计算得出
- 该参数需要加入planContext->checkItems->sessParams（该参数影响计划生成并且在线生效，所以修改参数需要失效plan cache）


#####   [切分算法](#切分算法)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c8b8970c2af4f520cb3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQkVBQUFBQ0FBQUFBQVFBUUFBQUlBUUFRQUFoQUFBQUFBQUFBSUFBQUJBQWdBQUFBQUFBQUFBQUFBWUFBQUFBQUFnQ0FBQUNBQUFRQUFBQUJRQUFBQUlFQXdBQUFBZ0FBQUFBQUFBQUFnQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQWdBTUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE0NTMsImV4cCI6MTc4MjMxMjI1M30.7ASeADK7ga9AZ2jbINWf-Hh-HHMNZHM42ltErEBNHaQ)

1. 如果计划生成的stage数量小于等于每个stage组最大需求worker数，则生成一个stage组即可
1. 如果计划生成的stage数量大于每个stage组最大需求worker数，则需要生成多个stage组，生成规则如下：
1.     - 每个stage组的stage，计算得出的需求worker数必须小于max_workers_per_exec，计算方法：
        - 创建一个stage组，依次遍历stage数组，将stage加入到stage组中
        - 一个stage需要一个worker运行，所以基础的需求worker权重为1
        - has_mat为true的stage，需求worker权重为1；has_mat为false的stage，需求worker权重为2（额外worker权重为父stage预留，父stage有可能不能启动）
        - 如果stage的子stage是has_mat为false且在最新的stage组中，需求worker权重需要-1（因为has_mat为false的子stage为父stage预留了权重，如果父stage起来，需要减掉子stage预留的权重，子stage可能有多个）
        - 当权重小于等于max_workers_per_exec时，当前stage放到当前stage组中，继续计算增加下一个stage权重
        - 当权重大于max_workers_per_exec时，生成一个新的stage组，当前stage放到新的stage组中，父stage不在stage组内则需要增加接收物化的stage，重复此步骤直到所有stage添加到stage组中完成
            - 对于需要增加接收物化的stage，一：调用makeMatStage向当前stage组中添加一个stage，该stage的rootPlan是MAT_SEND算子，MAT_SEND下是对应的PX_RECV算子。二：找到其父stage，将其PX_RECV替换成MAT_RECV算子。



![](https://pingcode.yasdb.com/atlas/files/public/67396c8b8970c2af4f520cb4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQkVBQUFBQ0FBQUFBQVFBUUFBQUlBUUFRQUFoQUFBQUFBQUFBSUFBQUJBQWdBQUFBQUFBQUFBQUFBWUFBQUFBQUFnQ0FBQUNBQUFRQUFBQUJRQUFBQUlFQXdBQUFBZ0FBQUFBQUFBQUFnQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQWdBTUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE0NTMsImV4cCI6MTc4MjMxMjI1M30.7ASeADK7ga9AZ2jbINWf-Hh-HHMNZHM42ltErEBNHaQ)

**matstage 生成示例**

![](https://pingcode.yasdb.com/atlas/files/public/67396c8c8970c2af4f520cb5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQkVBQUFBQ0FBQUFBQVFBUUFBQUlBUUFRQUFoQUFBQUFBQUFBSUFBQUJBQWdBQUFBQUFBQUFBQUFBWUFBQUFBQUFnQ0FBQUNBQUFRQUFBQUJRQUFBQUlFQXdBQUFBZ0FBQUFBQUFBQUFnQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQWdBTUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE0NTMsImV4cCI6MTc4MjMxMjI1M30.7ASeADK7ga9AZ2jbINWf-Hh-HHMNZHM42ltErEBNHaQ)

**stage group 示例**

```
create sharded table table_left_join(id int constraint c_unique_table_left_join_id unique, key int, f_bool boolean, f_tinyint tinyint, f_smallint smallint, f_int int, f_bigint bigint, f_float float, f_double double, f_number number(10, 2), f_char char(6), f_varchar varchar(6)) organization TAC PARTITION BY hash (id) PARTITIONS AUTO;
CREATE sharded TABLE table_right_join (id int constraint c_unique_table_right_join_id unique, key1 int, key2 int, a_bool boolean, a_tinyint tinyint, a_smallint smallint, a_int int, a_bigint bigint, a_float float, a_double double, a_number number(10, 2), a_char char(6), a_varchar varchar(6)) ORGANIZATION tac PARTITION BY HASH ( id ) PARTITIONS AUTO;

alter session set MAX_WORKERS_PER_EXEC = 2;
explain select f_smallint, f_bigint, f_int, a_int from table_left_join, table_right_join where f_int&gt;a_int order by f_smallint, f_bigint, table_left_join.id;

```

![](https://pingcode.yasdb.com/atlas/files/public/67396c8ca1ad9a3311dc8b24/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQkVBQUFBQ0FBQUFBQVFBUUFBQUlBUUFRQUFoQUFBQUFBQUFBSUFBQUJBQWdBQUFBQUFBQUFBQUFBWUFBQUFBQUFnQ0FBQUNBQUFRQUFBQUJRQUFBQUlFQXdBQUFBZ0FBQUFBQUFBQUFnQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQWdBTUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE0NTMsImV4cCI6MTc4MjMxMjI1M30.7ASeADK7ga9AZ2jbINWf-Hh-HHMNZHM42ltErEBNHaQ)

####   [关键数据结构与接口](#关键数据结构与接口-3)  

```
/* 被transformPlan调用 */
/* 自 rootStages 遍历 stage 树， 对于每个节点： */
/* 下层 stage 在本节点，上层 stage 不在本节点，切分出新的 stage tree， stage-&gt;hasMat 切分出新的 stage tree */
static CodResult walkStage(Anlwalker* walker, PxDecl* pxDecl);

/* 传入当前stage组以及需要添加接收物化的stage，生成的结果插入到group中 */
static CodResult makeMatStage(PxStageGroup* group, PxStage* stage);

```

####   [计划显示](#计划显示)  

- 新增配置参数：_enable_explain_stage会话级别参数    
  取值范围：[TRUE, FALSE]    
  默认值：FALSE    
  TRUE: 打印stage group info信息    
  FALSE：不打印stage group info信息
- 新增Stage GROUP Information (identified by stage group id)模块打印
- 在Operation Information 中增加stage id信息 （_enable_explain_stage为true的时候才显示）


**主要数据结构：**

```
static CodText gStageGroupLines[] = {
    COD_TEXT_DEF(""),
    COD_TEXT_DEF("Stage GROUP Information (identified by stage group id): "),
    COD_TEXT_DEF("---------------------------------------------------"),
    COD_TEXT_DEF(""),
    COD_TEXT_DEF("   - workers of stage group: %u"),
};

```

**示例：**

```
SQL&gt; explain select f_smallint, f_bigint, f_int, a_int from table_left_join, table_right_join where f_int&gt;a_int order by f_smallint,f_bigint,table_left_join.id;

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 2907706748                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
|  2 |   COL TO ROW                   |                      |            |3300000256|6364116992( 0)|                                |
|  3 |    SORT ORDER BY               |                      |            |3300000256|6364116992( 0)|                                |
|* 4 |     NESTED LOOPS INNER         |                      |            |3300000256|  8792736( 0)|                                |
|  5 |      MATERIAL AUX              |                      |            |    100000|      255( 0)|                                |
|  6 |       PX N2I REMOTE            | QUEUE_0              |            |    100000|      255( 0)|                                |
|  7 |        PART SCAN ALL           |                      |            |    100000|      240( 0)| [0,20]                         |
|  8 |         TABLE ACCESS BY INDEX ROWID| TABLE_LEFT_JOIN      | REGRESS    |          |             |                                |
|  9 |          INDEX FAST FULL SCAN  | C_UNIQUE_TABLE_LEFT_JOIN_ID| REGRESS    |    100000|      240( 0)|                                |
| 10 |      MATERIAL AUX              |                      |            |    100000|     9581( 0)|                                |
| 11 |       PX N2I REMOTE            | QUEUE_1              |            |    100000|      253( 0)|                                |
| 12 |        PART SCAN ALL           |                      |            |    100000|      241( 0)| [0,20]                         |
| 13 |         TABLE ACCESS BY INDEX ROWID| TABLE_RIGHT_JOIN     | REGRESS    |          |             |                                |
| 14 |          INDEX FAST FULL SCAN  | C_UNIQUE_TABLE_RIGHT_JOIN_ID| REGRESS    |    100000|      241( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   2 - Projection: RemoteTable[2][SMALLINT], RemoteTable[2][BIGINT], RemoteTable[2][INTEGER], RemoteTable[2][INTEGER], RemoteTable[2][INTEGER]
   3 - Projection: Tuple[0, 0][SMALLINT], Tuple[0, 1][BIGINT], Tuple[0, 2][INTEGER], Tuple[0, 3][INTEGER], Tuple[0, 4][INTEGER]
   4 - Projection: Tuple[0, 1][SMALLINT], Tuple[0, 2][BIGINT], Tuple[0, 0][INTEGER], Tuple[1, 0][INTEGER], Tuple[0, 3][INTEGER]
       Predicate : filter(Tuple[0, 0] &gt; Tuple[1, 0])            
   5 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][SMALLINT], Tuple[0, 2][BIGINT], Tuple[0, 3][INTEGER]
	   StageInfo: (stageId)	   
   6 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][SMALLINT], Tuple[0, 2][BIGINT], Tuple[0, 3][INTEGER]
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
	   StageInfo: (stageId)
   7 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][SMALLINT], Tuple[0, 2][BIGINT], Tuple[0, 3][INTEGER]
   9 - Projection: Tuple[0, 5][INTEGER], Tuple[0, 4][SMALLINT], Tuple[0, 6][BIGINT], Tuple[0, 0][INTEGER]
  10 - Projection: Tuple[0, 0][INTEGER]                         
       StageInfo: (stageId)	   
  11 - Projection: Tuple[0, 0][INTEGER]                         
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
	   StageInfo: (stageId)
  12 - Projection: Tuple[0, 0][INTEGER]                         
  14 - Projection: Tuple[0, 6][INTEGER]   

Stage GROUP Information (identified by stage group id):
---------------------------------------------------
  - workers of stage group: %u
  0  - [stageId,stageId,...]
  1  - [stageId,stageId,...]
  2  - [stageId,stageId,...]
  ...

42 rows fetched.

```

##   [4. Testcases（UT）](#4-testcasesut)  

|输入算子树|输出|
|---|---|
|仅带PX||
|仅带MAT||
|既带PX又带MAT||
|非关联子查询带PX||
|非关联子查询带MAT||
|非关联子查询带PX和MAT||


##   [5. TODO](#5-todo)  

## Attachments:

[WXWorkLocal_17025210942392.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODlhMWFkOWEzMzExZGM4YjEyIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.N3YfAdRmIlsExEbjnrNnSP_IMwzbgq_Fv72LIS_MyyI)

 (image/png)    


[WXWorkLocal_17025211304605.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODlhMWFkOWEzMzExZGM4YjEzIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.W0oo0G21fw5lrjF92fR4EG7bsG3kG4MXnhaOzDxKFv8)

 (image/png)    


[WXWorkLocal_17029888378254.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODk4OTcwYzJhZjRmNTIwY2EwIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.9WqzEs5TxdD-SxtftQONhKzFtZ_9MznpxfShoFhw-gA)

 (image/png)    


[WXWorkLocal_17029894006869.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODk4OTcwYzJhZjRmNTIwY2ExIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.z1XGqG-MJjdDm1hbzz7HF-fgGlM0cNgG18anxJjrLf8)

 (image/png)    


[WXWorkLocal_17029895997645.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODk4OTcwYzJhZjRmNTIwY2EyIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.HFG3yZImHp0x3__Vij2NP4irPfZcbq60UEOGLOkyRDI)

 (image/png)    


[transform基本流程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGE4OTcwYzJhZjRmNTIwY2EzIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.Mj0RZnRk2f6hMkvED4-RgYKWaPotJJz8svX2rPPTY8A)

 (image/png)    


[image2023-12-27_11-43-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGFhMWFkOWEzMzExZGM4YjE0IiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.sv0D_jJqUdq2Af9hQJmWdQO-U7oedhsBr3Rb6AekHFc)

 (image/png)    


[WXWorkLocal_17037657668757.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGFhMWFkOWEzMzExZGM4YjE1IiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.xUGB_01AbJxVSGfLqGLzVbfrtIFRmQbxHR2U_1_T1Jg)

 (image/png)    


[WXWorkLocal_17037657761841.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGE4OTcwYzJhZjRmNTIwY2E0IiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.35PXeEdHKzEAyFAfSocu1lsdfTKweVFC7j59ANWoSpY)

 (image/png)    


[transform.drawio](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGFhMWFkOWEzMzExZGM4YjE2IiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.Foh8pgckNgXTMOTR5SGH6hjN15374Vz4Rj7rD1IJTi4)

 (application/octet-stream)    


[WXWorkLocal_17038223306945.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGE4OTcwYzJhZjRmNTIwY2E1IiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.SN_ZkXYKrnq8O7E_JC2QMV6Dny92hfufBzOzT7TZrYs)

 (image/png)    


[WXWorkLocal_17038211753932.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGFhMWFkOWEzMzExZGM4YjE4IiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.7iSDGdVdEXKvAQ-xkH_XYabxOG75LnZoVSuzTs9_Zic)

 (image/png)    


[WXWorkLocal_17038223136309.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGFhMWFkOWEzMzExZGM4YjE5IiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.TYAVCGMOvvDjMvesYsFc9hj71CuACTqs_et-z7ooaV0)

 (image/png)    


[WXWorkLocal_17041862631116.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGE4OTcwYzJhZjRmNTIwY2E5IiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.fvxsrz2CPbGfGxa5SL1lTNqFQQ1EVUYvywpB4qek43w)

 (image/png)    


[WXWorkLocal_17041880372705.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGJhMWFkOWEzMzExZGM4YjFiIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.wO21JDqGc22qEJNF1WYLkC_TPE4bDrdGM9qpnhYVUbo)

 (image/png)    


[transform(1).drawio](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGJhMWFkOWEzMzExZGM4YjFjIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.U7uP_jW-FNyw756Y5F6Vp-rpH7X-rGXJuUJn9RXUm_c)

 (application/octet-stream)    


[优化器流程-stage调度顺序切分示例.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGJhMWFkOWEzMzExZGM4YjFkIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.-EmoWhFpxCJL1TG_84X5otzpYG10XDNkFpJbaZW2scM)

 (image/png)    


[transform基本过程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGI4OTcwYzJhZjRmNTIwY2FjIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.5WTO8OuXteyjdoi7T4I0WIgNfCNnZll0aloGWFySPQo)

 (image/png)    


[优化器流程-stage调度顺序切分示例.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOGJhMWFkOWEzMzExZGM4YjFmIiwicmVmX2lkIjoiNjczOTZjODk1OTNmOTljOWZmMjM2ZmMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNDUzLCJleHAiOjE3ODIzODc4NTN9.hzs-fBh8ZGdUBk1GV02MV5w64C-_LhkKbpIb0Q5aqpA)

 (image/png)    


## Comments:

|  [](null)  ,配置项（先不实现）：,- 申请不到的最小线程数（申请不到超过的线程数时，需要动态切分）
,Posted by linjunzhe at 十二月 19, 2023 20:34|
|---|
|  [](null)  ,12.27,1、刷新图,Posted by liyi at 十二月 27, 2023 20:00|
|  [](null)  ,1、分布式子查询改造成NL JOIN,Posted by heyang at 十二月 28, 2023 11:22|
