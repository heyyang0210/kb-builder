Created by 陈晓晴, last modified on 十一月 14, 2023

## SR链接：    [https://jira.yasdb.com/browse/YDBRD-21586](https://jira.yasdb.com/browse/YDBRD-21586)  

##   [1. Overview（概述）](#1-overview概述)  

LSC目前支持的增量导入都是直接写入热数据。需要一种支持直接导入到稳态数据的增量导入方式，省略数据从热转冷的过程，且可以进行批量的优化，从而提高导入的效率。

##   [2. Features（功能特性）](#2-features功能特性)  

单机、分布式部署下支持( ? )方式增量写入冷数据。当前及其他事务不可见该增量数据，只有当事务提交了以后，数据才可见。

##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [语法](#语法)  

#####   [方案一：](#方案一)  

INSERT [hint] (single_table_insert|multi_table_insert)

新增HINT提示项名称：BULKLOAD。表示对单表的插入进行批量化的处理。

#####   [方案二：](#方案二)  

LOAD INTO table_reference [t_alias] [("(" column_name ")") {"," ("(" column_name ")")}] insert_values_clause.

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 语法只支持LSC表。
1. 不支持多表插入使用该hint。
1. 在开始增量导入后，不允许创建savepoint。已经有savepoint的情况下，也不允许进行增量导入。
1. 开启了自动提交后不允许进行增量导入。
1. 当一个会话开启对一张LSC表的增量导入后，必须要提交或者回滚后，当前会话才能操作其他LSC表进行增量导入，否则会报错处理。
1. 由增量导入语句导致的失败会使整个事务回滚(语法错误的失败除外)。
1. 一个事务内开始增量导入后，不允许对该表进行除插入、查询外的其他dml操作，也不允许对该表进行on duplicate update操作。
1. 23.1交付版本不支持insert带子查询的语句支持该hint，23.2交付版本需要支持insert带子查询的语句支持该hint。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

###   [5.2.1 解析、校验、执行阶段：](#521-解析校验执行阶段)  

```
//context上新增bulkLoad标记位
typedef struct StInsertContext {
    HintContext*     hint;
    ObjectArray*     inserts;
    QueryContext*    subQuery;
    UpdateTable*     update;
    DatasetDecl*     dsDecl;
    InsertSyntaxType syntaxType;
    CodBool          isMultiInsert;
    CodBool          isLinkTable;
    CodBool          isBulkLoad;
    CodUint8         unused;
} InsertContext;

```

通过insertContext上的bulkLoad标记透传到stmt上，从而在openCursor的阶段传给存储bulkLoad标记。

校验阶段需要检查handler上是否已有rgdCtx并对比插入的表的dataoid与rgdCtx上记录的dataOid是否一致。

####   [方案一：使用load into特殊命令](#方案一使用load-into特殊命令)  

新增load into 命令，但内部执行按照普通insert方式，带上bulkLoad特殊标记。

```
//新增AnlProcessor类型（与SQL_LOAD需要区分开）,除去parse流程其他与insert流程一致
[SQL_LOAD_INTO] = {
        .name = "load into",
        .parse = parseLoadInto,
        .verify = verifyInsert,
        .rewrite = rewriteInsert,
        .createPlan = createCboPlan,
        .execute = execInsert,
    },

```

####   [方案二：使用hint决定导入冷数据](#方案二使用hint决定导入冷数据)  

解析到bulkLoad的hint提示项后标记insertContext上bulkLoad为true。

###   [5.2.2 存储：](#522-存储)  

通过cursor->attr.insertAction决定走已实现的冷数据bulkLoad方式进行插入。bulkLoad方式插入的特点是，存储将接收到的dataSet数据深拷贝到存储层设置的缓存区rgd缓存起来，

当rgd中的数据量（行数）达到设置的上限后，会触发rgd的后台任务将数据转换成稳态数据。只有当会话执行了ankCommit操作后，稳态数据文件才可见。

rgd缓存在handler上，因此每个会话都有一块自己的rgd临时内存，只能用于临时存放一个表的数据，表的每个分区设置对应2块rgd。

bulkLoad原设计文档见    [https://conf.yasdb.com/pages/viewpage.action?pageId=81297621](https://conf.yasdb.com/pages/viewpage.action?pageId=81297621)  

###   [5.2.3 提交：](#523-提交)  

单机流程：ankExecCommit流程中，在ankCommit前调用ankEndBatchInsert结束rgd的所有操作。

分布式：分布式提交分单节点提交跟多节点协调提交。单节点提交流程dn为anlExecuteSingleCommit，多节点提交dn流程为anlExecuteXaPrepare、anlExecuteXaCommit。分别在anlExecuteSingleCommit、anlExecuteXaPrepare中结束rgd的操作。

###   [5.2.4 回滚：](#524-回滚)  

回滚到无事务状态的流程需要释放handler上的rgd资源：

**单机**  ：execRollback流程中调用ankEndBatchInsert

**分布式**  ：anlExecRollbackAll中调用ankEndBatchInsert

当前执行失败的sql，回滚流程也需要释放handler上的rgd资源，建议插入事务中不进行除了本表插入外的其他操作。

**单机：**   anlRollback中释放

**分布式：**   anlExecuteRollbackCurrent中释放

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1.资源充足的场景，增量导入能正常完成

2.增量导入失败的正常回滚，恢复到未执行增量导入前的状态。

3.增量导入结束后不会有内存泄露。

4.增量导入与dml、ddl并发场景。

4.性能测试：

（1）bulkLoad使用csv导入对比

（2）无主键情况下，使用DATAX走增量导入性能应当达到（与竞品相当）。

##   [7.资料设计章节](#7资料设计章节)  

####   [大纲：](#大纲)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=130144947](https://conf.yasdb.com/pages/viewpage.action?pageId=130144947)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,1. insert into select加该hint情况需要实现。
1. 导入过程中进行查询，不保证数据的可见性
1. 语法推荐方案一
,Posted by chenxiaoqing at 十月 26, 2023 11:26|
|---|
|  [](null)  ,补充规格：导入事务内不允许执行其他类型语句,Posted by xierui at 十一月 07, 2023 17:13|
