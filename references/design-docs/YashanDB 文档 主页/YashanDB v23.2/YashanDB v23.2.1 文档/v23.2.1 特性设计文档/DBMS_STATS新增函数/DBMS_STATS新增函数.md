Created by 郑翌恺, last modified on 一月 08, 2024

#   [YDBRD-22121 : DBMS_STATS新增函数方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

SR链接：    [[YDBRD-22121] 高级包DBMS_STATS新增函数 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22121)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

高级包DBMS_STATS新增函数

删除统计信息：    
  DELETE_TABLE_STATS    
  DELETE_SCHEMA_STATS    
  DELETE_INDEX_STATS    
    
  设置各个维度的选项的参数：    
  GET_PREFS    
  DELETE_SCHEMA_PREFS    
  DELETE_TABLE_PREFS    
    
  DELETE_COLUMN_STATS增加cascade_part, force参数

适配版本：单机、集群

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

### 有default的选项可以被省略

### 2.1 DELETE_TABLE_STATS

```
DBMS_STATS.DELETE_TABLE_STATS (
   ownname          VARCHAR,
   tabname          VARCHAR,
   partname         VARCHAR  DEFAULT NULL,
   cascade_parts    BOOLEAN  DEFAULT TRUE,
   cascade_columns  BOOLEAN  DEFAULT TRUE,
   cascade_indexes  BOOLEAN  DEFAULT TRUE,
   force            BOOLEAN  DEFAULT FALSE);
```

  


|参数|说明|null?|
|:---|:---|---|
|ownname|用户名。NULL则为当前用户|null|
|tabname|表名|not null|
|partname|指定要删除统计信息的表分区的名称  ，,**如果该项已被指定，则删除对应分区的统计信息，不删除表的统计信息**,**如果表已分区且参数为NULL，则从全局表检索统计信息，和cascade_parts共同决定是否要删除分区**|null|
|cascade_parts|指定是否同时删除与表相关联的分区的统计信息。如果将 CASCADE_PARTS 参数设置为 true，则表示删除表及其所有分区的统计信息。如果设置为 false，则仅删除表本身的统计信息，而保留与该表关联的分区的统计信息。默认为TRUE。,**是否删除全部或指定分区的统计信息**|null|
|cascade_columns|指定是否同时删除与表相关联的所有列的统计信息，默认为TRUE,**调用DELETE_COLUMN_STATS实现，传参DELETE_COLUMN_STATS(user,table,partname,cascadeParts，force)**|null|
|cascade_indexes|指定是否同时删除与表相关联的所有索引的统计信息，默认为TRUE|null|
|force|指示是否强制删除锁定的统计信息。当值为TRUE时，此过程将删除表统计信息，即使已锁定，默认为false,**表的统计信息上锁之后，如果用force=TRUE强制删除表的统计信息，下次收集统计信息前仍需要unlock**|null|


|partname\cascade_parts|true|false|
|:---|:---|:---|
|null|删除表和全部分区|删除表，不删除任何分区|
|not null|不删除表，删除指定分区||


### 2.2 DELETE_SCHEMA_STATS

```
DBMS_STATS.DELETE_SCHEMA_STATS (
   ownname          VARCHAR,
   force            BOOLEAN  DEFAULT FALSE);
```

|参数|说明|null?|
|:---|:---|---|
|ownname|用户名。NULL则为当前用户|null|
|force|指示是否强制删除锁定的统计信息。当值为TRUE时，此过程将删除表统计信息，即使已锁定，默认为false|null|


### 2.3 DELETE_INDEX_STATS

```
DBMS_STATS.DELETE_INDEX_STATS (
   ownname          VARCHAR,
   indname          VARCHAR,
   partname         VARCHAR  DEFAULT NULL,
   cascade_parts    BOOLEAN  DEFAULT TRUE,
   force            BOOLEAN  DEFAULT FALSE);
```

|参数|说明|null?|
|:---|:---|---|
|ownname|用户名。NULL则为当前用户|null|
|indname|索引名|not null|
|partname|指定要删除统计信息的表分区的名称  ，如果表已分区且参数为NULL，则从全局表检索统计信息|null|
|cascade_parts|指定是否同时删除与索引相关联的分区的统计信息。如果将 CASCADE_PARTS 参数设置为 true，则表示删除表及其所有分区的统计信息。如果设置为 false，则仅删除表本身的统计信息，而保留与该表关联的分区的统计信息。|null|
|force|指示是否强制删除锁定的统计信息。当值为TRUE时，此过程将删除表统计信息，即使已锁定|null|


### 2.4 DELETE_COLUMN_STATS

```
DBMS_STATS.DELETE_COLUMN_STATS (
   ownname          VARCHAR,
   tabname          VARCHAR,
   colname          VARCHAR,
   partname         VARCHAR  DEFAULT NULL,
   type             VARCHAR,
   cascade_parts    BOOLEAN  DEFAULT TRUE,
   force            BOOLEAN  DEFAULT FALSE);
```

|参数|说明|
|:---|:---|
|ownname|用户名。NULL则为当前用户|
|tabname|表名|
|colname|列名|
|partname|指定要删除统计信息的表分区的名称  ，如果表已分区且参数为NULL，则从全局表检索统计信息|
|type |删除类型（'ALL'：同时删除column统计信息和直方图，'HISTOGRAM'：只删除直方图）|
|cascade_parts（新增参数）|指定是否同时删除与索引相关联的分区的统计信息。如果将 CASCADE_PARTS 参数设置为 true，则表示删除表及其所有分区的统计信息。如果设置为 false，则仅删除表本身的统计信息，而保留与该表关联的分区的统计信息。|
|force（新增参数）|指示是否强制删除锁定的统计信息。当值为TRUE时，此过程将删除表统计信息，即使已锁定|


### 2.5 GET_PREFS

```
DBMS_STATS.GET_PREFS (
   pname     IN   VARCHAR,
   ownname   IN   VARCHAR DEFAULT NULL,
   tabname   IN   VARCHAR DEFAULT NULL)
 RETURN VARCHAR2;
```

|参数|说明|null?|
|:---|:---|---|
|pname|选项名|not null|
|ownname|用户名，可忽略|null|
|tabname|表名，可忽略|null|


### 2.6 DELETE_TABLE_PREFS

```
DBMS_STATS.DELETE_TABLE_PREFS (
    ownname    IN  VARCHAR,
    tabname    IN  VARCHAR,
    pname      IN  VARCHAR);
```

|参数|说明|
|:---|:---|
|ownname|用户名|
|tabname|表名|
|pname|选项名，目前已实现的选项及默认值：,- CASADE：FALSE。  表示在收集表的统计信息的时候，是否级联收集索引的统计信息
- DEGREE：1。  表示收集统计信息的并行度
- ESTIMATE_PERCENT：1。  表示采样率，范围是0.000 001～100。  这个参数主要是用于CBO估算表的总行数，采样率越高，CBO估算的表行数越接近于真实值，执行计划越能走正确。
- GRANULARITY：GLOBAL。  表示收集统计信息的粒度，该选项只对分区表生效，默认为 AUTO，表示让Oracle根据表的分区类型自己判断如何收集分区表的统计信息。
- METHOD_OPT：FOR ALL COLUMNS SIZE AUTO。  用于控制收集直方图策略。  直方图简就是数据库了解表中某列的数据分布，从而更正确的走更优的执行计划
- STALE_PERCENT：0.1。  用于确定阈值级别，在该阈值级别，对象被认为具有过时的统计信息。该值是自上次统计信息收集以来已修改的行的百分比。
- OPTIONS：GATHER.确定GATHER_TABLE_STATS过程中使用的选项参数。
|


### 2.7 DELETE_SCHEMA_PREFS

```
DBMS_STATS.DELETE_SCHEMA_PREFS (
    ownname   IN   VARCHAR2,
    pname     IN   VARCHAR2);
```

|参数|说明|
|:---|:---|
|ownname|用户名|
|pname|选项名|


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

### 3.1 系统表和系统视图

表的统计信息持久化在tab$和tabpart$上，可以通过dba_tab_statistics查看

```
select * from dba_tab_statistics where table_name = 'STATS_TEST1';
```

列的统计信息持久化在  HIST_HEAD$和HISTGRM$中，可以通过dba_tab_col_statistics和dba_part_col_statistics查看

```
select * from dba_tab_col_statistics where table_name = 'STATS_TEST1';
```

索引的统计信息持久化在IND$上，可以通过dba_ind_statistics查看

```
select * from dba_ind_statistics where table_name = 'STATS_TEST1';
```

统计信息选项持久化在STATS_PREFS$上，可以通过dba_tab_stat_prefs查看，但是默认的统计信息选项不会保存在视图中，在STATS_PREFS$里的oid为-1

```
select * from dba_tab_stat_prefs where table_name = 'STATS_TEST1';
```

### 3.2 sql语法

```
exec DBMS_STATS.DELETE_TABLE_STATS('USER','STATS_TEST1','P1',TRUE,TRUE,TRUE,FALSE);
exec DBMS_STATS.DELETE_SCHEMA_STATS('USER',FALSE);
exec DBMS_STATS.DELETE_INDEX_STATS('USER','STATS_INDEX_TEST1','P1',TRUE,FALSE);
exec DBMS_STATS.DELETE_COLUMN_STATS('USER','STATS_TEST1','COL1','P1',TRUE,FALSE);

exec DBMS_STATS.DELETE_TABLE_PREFS('USER','STATS_TEST1','DEGREE');
exec DBMS_STATS.DELETE_SCHEMA_PREFS('USER','DEGREE');
select DBMS_STATS.GET_PREFS('DEGREE','USER','STATS_TEST1') from dual;
```

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

DBMS_STATS新增函数参数约束及默认值如2.1-2.7所示

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 5.1 DELETE_TABLE_STATS

#### 1.DELETE_TABLE_STATS数据结构

```
typedef struct StDelTabStatsDef {
    CodText    owner;               //用户名
    CodText    table;               //表名
    CodText    part;                //分区名
    CodBool    cascadeParts;        //是否删除全部分区统计信息
    CodBool    cascadeColumns;      //是否删除全部列统计信息 
    CodBool    cascadeIndexes;      //是否删除全部索引统计信息
    CodBool    force;               //是否强制删除被锁定的统计信息
    TableDict* dc;                  //删除用户统计信息时会遍历表，将dc传入statsDeleteTable
} DelTabStatsDef;
```

#### 2.DELETE_TABLE_STATS函数接口

|name|Meaning|
|:---|:---|
|bipexecDeleteTableStats|识别传入的参数并初始化默认值|
|ankDeleteTableStats|判断权限，分区和表是否被上锁，尝试对表上锁，获取分区等前置准备|
|statsDeleteTable|判断是否要删除分区/表的统计信息|
|tabDeleteStats|删除系统表中的统计信息|
|dcDeleteTableStats|无效化dc中的统计信息|


#### 3.以DELETE_TABLE_STATS为例介绍详细设计

1.在bip_stats.c中增加bipVerifyDeleteTableStats()和bipexecDeleteTableStats()，用于识别传入的参数并初始化默认值

2.在ank_table_stats.c中增加ankDeleteTableStats()，用于判断权限，分区和表是否被上锁，尝试对表上锁，获取分区等前置准备，

根据force参数，决定是否可以删除被上锁的统计信息，删除后统计信息仍然处于锁定状态

根据cascadeColumns和  cascadeIndexes参数，决定是否要同步删除列统计信息和索引统计信息，若要删除，遍历该表的所有列/索引，依次调用statsDeleteColumn和statsDeleteIndex

增加statsDeleteTable()，根据传入的partname和cascadeParts判断删除全部分区/删除特定分区/不删除任何分区

|partname\cascade_parts|true|false|
|:---|:---|:---|
|null|删除表和全部分区|删除表，不删除任何分区|
|not null|不删除表，删除指定分区||


3.在dict_table.c增加tabDeleteStats，将系统表tab$和tabpart$中统计信息相关列置为NULL

4.在dc_table.c增加dcDeleteTableStats，将  stats->base.isGathered置为  FALSE，无效化dc中的统计信息

### 5.2 在集群环境下，增加接口

#### 1.函数接口

|name|Meaning|
|:---|:---|
|AXC_CB->axcBcstDeleteStats|广播同步删除统计信息修改的dc内存|


#### 2.消息接口

|name|function|Meaning|
|:---|:---|:---|
|MSG_DELETE_STATS|msgDeleteStats|执行实例广播给其他实例同步dc内存|


#### 3.数据结构

```
typedef struct StRecDeleteStats {
    CodUint64 tabId;      // table oid
    CodUint64 idxId;      // index id
    CodUint64 pnum;       // part number
    CodUint8  type;       // STATS_COLUMN/STATS_TABLE/STATS_INDEX
    CodUint8  unused[3];
    CodUint8  columnId;
    CodBool   colDeleteAll;
} RecDeleteStats;
```

#### 4.详细设计

1.按照单机逻辑执行ankDeleteTableStats，之后广播层会处理某个table/某个index/某个table part/某个index part/某个table的单一列/某个part table的单一列

2.在系统表和dc修改完成后，调用AXC_CB->axcBcstDeleteStats进行广播，广播内容为BcstDeleteStats结构体中的内容

3.被广播到消息的实例根据BcstDeleteStats中的内容读取系统表，修改  stats->base.isGathered置为  FALSE，无效化dc中的统计信息

#### 5..并发问题

具体场景可能为：对同一张表进行gather和delete操作，delete先删系统表内容，然后广播更新dc，其他实例收到广播时要更新dc，    
  但此时gather并发，系统表内又被写入了新的统计信息，就会导致实例的dc统计信息清空，但是系统表有统计信息

解决方法：  **将写系统表和更新dc整合为一个原子操作，上锁**

### 5.3 删除和获取统计信息选项

#### 1.详细设计

统计信息选项及默认值都存储在STATS_PREFS$系统表中，根据oid和pname搜索系统表并删除对应行即可

对于  **pname = **  **STALE_PERCENT**  （统计信息失效的变化率阈值），需要专门更新dc->statsSet.stalePct，在集群下广播

```
STATS_PREFS$
(
    OBJ#            BINARY_BIGINT       NOT NULL,
    PNAME           VARCHAR(30)         NOT NULL,
    VALCHAR         VARCHAR(4000)       NOT NULL,
    CHGTIME         TIMESTAMP           NOT NULL
)
```

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

在stats.sql增加regress用例