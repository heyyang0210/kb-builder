

-   [1. 总述](#id-概要-1.总述)  
    -   [1.1需求分析](#id-概要-1.1需求分析)  
-   [2. 功能列表](#id-概要-2.功能列表)  
-   [3. 规格与约束](#id-概要-3.规格与约束)  
-   [4. 特性](#id-概要-4.特性)  
    -   [4.1整体设计](#id-概要-4.1整体设计)  
        -   [逻辑导出](#id-概要-逻辑导出)  
        -   [逻辑导入](#id-概要-逻辑导入)  
        -   [CSV数据导出](#id-概要-CSV数据导出)  
    -   [4.2导出文件](#id-概要-4.2导出文件)  
        -   [csv导出](#id-概要-csv导出)  
        -   [元数据导出格式](#id-概要-元数据导出格式)  
        -   [字符集](#id-概要-字符集)  
-   [5.未来规划](#id-概要-5.未来规划)  


#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

  


逻辑导入和导出是数据库管理重要的数据操作方式，可以用于数据备份、数据迁移、数据库升级等多种场景，是数据库管理和维护中的关键操作之一。

- 数据备份：逻辑导出，可以将数据库中特定的数据导出到一个独立的文件中，作为数据库的备份。需要时，使用此备份文件中，重新导入到数据库，实现数据的恢复。
- 数据迁移：可以将导出的数据导入到目标数据库中，完成数据迁移。
- 数据库升级：在数据库升级过程中，导出当前数据库中的数据，导入到新数据库版本中，完成数据库升级。


YashanDB支持同构数据库的数据/元数据迁移，同时支持异构数据库间的数据迁移。

同构：YashanDB导出的二进制/CSV文件，可导入到YashanDB，实现迁移。

异构：YashanDB导出的CSV数据，可通过oracle的导入工具导入到ORACLE中，实现异构数据库间的数据迁移。

![](https://pingcode.yasdb.com/atlas/files/public/673996ff8970c2af4f52b67a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQkFBQUFDQUFBQUJCQUFBQUFBQUFBQUFBQUNBQUNBQUJRQ2dCQUFBQUFBQUFBUUFCQVFBQUFBQUFBQUFBQUFBS0FBQUFJSUFBQUFBSUFBQUFDUUFBQUFBQUFBQUFBQWdBQUFrQUFDQUFBQUFBQUFBQUFBQ0NBQUpJQUFBQUFBQUFBQUFRQUFBQUVDQUFBUUFBQUNCQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyODEsImV4cCI6MTc4MjEzNzA4MX0.gCHIpEa1DhhE4uMfBN-jZEplWwc9YaHaYqHtY82pQ8A)

## 1.1需求分析

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|易用性|导出/导入进展可视化|----|否|是|----|
|可修改性|----|----|NA|不涉及|----|
|兼容性|----|----|NA|不涉及|----|
|可维可测|  
|  
|  
|  
|  
|
|功能|- 导出
    - 支持全库导出
    - 支持导出指定用户下对象
    - 支持导出指定表
    - 支持是否导出数据
    - 可指定导出文件路径
    - 支持CSV格式数据的导出
- 导入
    - 支持导入文件中的所有对象
    - 支持从文件中挑选部分用户的对象，进行导入
    - 支持从文件中挑选部分表对象，进行导入
    - 可指定导入文件
    - 当创建的表已存在，可选择表数据等是否进行导入。
    - 支持指定对象的schema进行导入
    - 支持是否导入数据
    - 支持是否导入元数据
|  
|是|是|----|
|  
|  
|  
|是|是|----|
|安全|  
|----|NA|不涉及|----|
|周边配合|审计|----|NA|不涉及|----|
|性能|导出导入性能|EXP并行|是|是|----|
|可用性|恢复场景|----|NA|不涉及|----|
|可靠性|故障场景|----|NA|不涉及|----|
|周边配合|权限|----|NA|不涉及|----|


#   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  功能列表

EXP/IMP通过不同的配置参数，对外提供丰富的功能项。功能项及使用方式如下所示：

|工具|功能|配置项|
|---|---|---|
|导出|- 支持全库导出
- 支持导出指定用户下对象
- 支持导出指定表
- 支持是否导出数据
- 可指定导出文件路径
- 支持CSV格式数据的导出
|- FULL
- OWNER
- TABLE
- ROWS
- FILE
--CSV|
|导入|- 支持导入文件中的所有对象
- 支持从文件中挑选部分用户的对象，进行导入
- 支持从文件中挑选部分表对象，进行导入
- 可指定导入文件
- 当创建的表已存在，可选择表数据等是否进行导入。
- 支持指定对象的schema进行导入
- 支持是否导入数据
- 支持是否导入元数据
|- FULL
- FROMUSER
- TABLES
- FILE
- IGNORE
- TOUSER
- ROWS
- DATA_ONLY
|


#   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- 部署形态：支持单机/分布式/集群部署形态。


#   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

## 4.1整体设计

![](https://pingcode.yasdb.com/atlas/files/public/673996ffa1ad9a3311dd34da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQkFBQUFDQUFBQUJCQUFBQUFBQUFBQUFBQUNBQUNBQUJRQ2dCQUFBQUFBQUFBUUFCQVFBQUFBQUFBQUFBQUFBS0FBQUFJSUFBQUFBSUFBQUFDUUFBQUFBQUFBQUFBQWdBQUFrQUFDQUFBQUFBQUFBQUFBQ0NBQUpJQUFBQUFBQUFBQUFRQUFBQUVDQUFBUUFBQUNCQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyODEsImV4cCI6MTc4MjEzNzA4MX0.gCHIpEa1DhhE4uMfBN-jZEplWwc9YaHaYqHtY82pQ8A)

与物理备份不同，逻辑备份/恢复（逻辑导入导出），与服务端的交互统一走SQL执行逻辑。逻辑导入导出支持对象元数据/数据的备份，其中元数据在导出文件中以DDL语句形式组织，导入通过执行DDL语句进行元数据的恢复；数据在文件中以  **二进制的数据行**  格式组织，导入通过致执行DML语句进行数据恢复。

### 逻辑导出

逻辑导出，支持导出对象的  **元数据**  及  **数据。**

- **数据**  ：通过执行DQL语句，获取数据。为减少EXP/IMP过程数据类型的转换，数据以二进制形式持久化到本地。
- **元数据**  ：
    - 系统表：数据库中对象的元数据信息存储在  **系统表**  中，  **元数据导出的信息来自系统表**  ，但是一个对象的元数据获取，可能涉及多张系统表复杂的查询；此外，系统表属于SYS用户，访问SYS下的数据不好做权限控制。
    - 系统视图  **：**  是将系统表作为自己的基表，将复杂基表查询作为自身的子语句，屏蔽掉了元数据间复杂的关系，简化查询流程，同时，便于权限控制/数据隔离。基于系统视图的以上优点，导出过程中  **元数据的获取采用系统视图**  。


导入导出支持的对象类型及元数据获取的方式如下所示：

|一级分类|二级分类|类型|元数据获取来源|
|---|---|---|---|
|用户/用户属性|  
|profile|dba_profiles|
||  
|用户|dba_users|
|权限|  
|角色|dba_roles|
||  
|系统权限|dba_sys_privs/dba_role_privs|
||  
|对象权限|dba_tab_privs|
|表  

|表类型|行表/列表|- 表信息：dba_tables
- 列信息：dba_tab_cols
|
|||分区表|- 分区表：dba_part_tables
- 分区键：dba_part_key_columns
- 二级分区键：dba_subpart_key_columns
- 分区模板：  dba_subpartition_templates
- 分区存储属性：dba_part_store
|
|||分布表|- 分布表信息：dba_dist_tables
- 分布键信息：dba_dist_key_columns
|
|||全局临时表|dba_tables|
|||嵌套表|ALL_NESTED_TABLES|
||表数据|普通数据类型：,- 字符串：char/ncahr/varchar/nvarchar
- 二进制：binary/bit
- 时间（间隔）：date/timestamp/interval(YM/DS)/shorttime
- 数值：number/float/double/bigint/int/small int/tiny int
- 其他：rowid/bool
|\|
|||大对象：CLOB/BLOB/NCLOB/XML/JSON|\|
||表约束|主键|- 表约束信息：dba_constraints/  dba_constraint_defs
- 约束列信息：all_cons_columns
|
|||外键||
|||唯一/  Check  约束||
||索引|索引/分区索引|- 索引信息：dba_indexes
- 索引列信息：dba_ind_columns
- 分区索引信息：dba_part_indexes
- 索引的分区信息：dba_ind_partitions
- 索引的二级分区信息：dba_ind_subpartitions
|
||注释|表/列注释|- 表注释：dba_tab_comments
- 列注释：dba_col_comments
|
|对象|  
|存储过程/函数/触发器/PACKAGE(BODY)/LIBRARY|dba_source|
||  
|JOB|dba_scheduler_jobs|
||  
|视图/物化视图|- 视图：dba_views
- 物化视图：dba_mviews
,  
|
||  
|同义词|dba_synonyms|
||  
|序列|dba_sequences|
||  
|AC|AC信息：dba_acs,AC的列信息：dba_ac_columns|
|其他|  
|type|dba_objects |
||  
|dblink|dba_db_links|
||  
|审计|- 审计策略：audit_unified_policies
- 审计的使能信息：audit_unified_enabled_policies
|
||  
|outline|dba_outlines|
||  
|sqlmap|sql_map$|


### 逻辑导入

逻辑导入，通过执行DDL语句进行元数据的恢复；执行DML语句，进行数据的恢复。在导入前，检查文件有效性及服务端表空间的完备性，减少导入过程中失败的机率。

文件检查

- 有效性检查：需要检查文件的有效性，只有是成功导出的完整文件，才能被导入。
- 表空间检查：当前文件中的对象所在的表空间，在导入前，需要对目标库进行检查，如果目标库的表空间不健全，则终止导入。


对象筛选

- 挑选要导入的对象，支持挑选特定的表/用户，及全库进行导入。 导入过程，将对象元数据组装成可执行的DDL语句，数据组装成DML语句，执行SQL，达到逻辑恢复的目的。


![](https://pingcode.yasdb.com/atlas/files/public/673996ff8970c2af4f52b67b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQkFBQUFDQUFBQUJCQUFBQUFBQUFBQUFBQUNBQUNBQUJRQ2dCQUFBQUFBQUFBUUFCQVFBQUFBQUFBQUFBQUFBS0FBQUFJSUFBQUFBSUFBQUFDUUFBQUFBQUFBQUFBQWdBQUFrQUFDQUFBQUFBQUFBQUFBQ0NBQUpJQUFBQUFBQUFBQUFRQUFBQUVDQUFBUUFBQUNCQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyODEsImV4cCI6MTc4MjEzNzA4MX0.gCHIpEa1DhhE4uMfBN-jZEplWwc9YaHaYqHtY82pQ8A)

### CSV数据导出

Yashan导出的CSV文件，可进行同构/异构间的数据恢复。其中Yashan导入可使用yasldr，oracle导入可使用其配套工具sqlldr。

导出表的数据，为提升导出的性能，支持表粒度的并从导出。并行导出各线程工作示意图如下所示。

- 主线程：
    - 封装任务，任务的粒度是表。
    - 开子线程
    - 等待消费任务，回收子线程。
- 子线程
    - 消费线程：负责向服务端数据交互。
    - Flush线程，本地io线程。负责数据的落盘。


![](https://pingcode.yasdb.com/atlas/files/public/673996ffa1ad9a3311dd34db/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQkFBQUFDQUFBQUJCQUFBQUFBQUFBQUFBQUNBQUNBQUJRQ2dCQUFBQUFBQUFBUUFCQVFBQUFBQUFBQUFBQUFBS0FBQUFJSUFBQUFBSUFBQUFDUUFBQUFBQUFBQUFBQWdBQUFrQUFDQUFBQUFBQUFBQUFBQ0NBQUpJQUFBQUFBQUFBQUFRQUFBQUVDQUFBUUFBQUNCQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyODEsImV4cCI6MTc4MjEzNzA4MX0.gCHIpEa1DhhE4uMfBN-jZEplWwc9YaHaYqHtY82pQ8A)

## 4.2导出文件

### csv导出

csv导出数据，为字符串的csv标准格式，仅包含数据，不包含元数据。

### 元数据导出格式

导入过程中，文件的解析是顺序完成的，为成功完成元数据的导入，对象在文件中要根据依赖关系组织，使其在导入时，被依赖的对象先创建。

其次，为支持全库/指定用户/指定表导入，需要从文件中  **筛选特定的对象**  ，文件的格式要能满足以下功能点：

- 对象筛选：每个对象都需要记录其上下游关系，如：表T1所属用户/表空间，T1下的数据/索引/约束等，协助筛选出某用户下的表T1所有的信息。
- 跳读：当某一对象不符合导入要求，要快速地忽略此对象。


为满足以上诉求，文件格式设计如下所示：

（1）  **整体格式**

![](https://pingcode.yasdb.com/atlas/files/public/673996ffa1ad9a3311dd34dc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQkFBQUFDQUFBQUJCQUFBQUFBQUFBQUFBQUNBQUNBQUJRQ2dCQUFBQUFBQUFBUUFCQVFBQUFBQUFBQUFBQUFBS0FBQUFJSUFBQUFBSUFBQUFDUUFBQUFBQUFBQUFBQWdBQUFrQUFDQUFBQUFBQUFBQUFBQ0NBQUpJQUFBQUFBQUFBQUFRQUFBQUVDQUFBUUFBQUNCQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyODEsImV4cCI6MTc4MjEzNzA4MX0.gCHIpEa1DhhE4uMfBN-jZEplWwc9YaHaYqHtY82pQ8A)

（2）属性标识

记录自身对象类型、从属的表空间/用户/表等，从而为对象的筛选提供信息。

表：owner--从属的用户；tablespace--从属的表空间；表信息–可执行的DDL语句

约束：owner--约束从属的用户；约束所归属的表；约束本身的信息（可执行的DDL语句）。

![](https://pingcode.yasdb.com/atlas/files/public/673996ff8970c2af4f52b67c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQkFBQUFDQUFBQUJCQUFBQUFBQUFBQUFBQUNBQUNBQUJRQ2dCQUFBQUFBQUFBUUFCQVFBQUFBQUFBQUFBQUFBS0FBQUFJSUFBQUFBSUFBQUFDUUFBQUFBQUFBQUFBQWdBQUFrQUFDQUFBQUFBQUFBQUFBQ0NBQUpJQUFBQUFBQUFBQUFRQUFBQUVDQUFBUUFBQUNCQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyODEsImV4cCI6MTc4MjEzNzA4MX0.gCHIpEa1DhhE4uMfBN-jZEplWwc9YaHaYqHtY82pQ8A)

（3）跳读

每1024个对象，公用一组对象尺寸元数据信息。长度信息为当前对象在文件中的字节长度，此尺寸用于导入过程的跳读。

![](https://pingcode.yasdb.com/atlas/files/public/67399700a1ad9a3311dd34dd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQkFBQUFDQUFBQUJCQUFBQUFBQUFBQUFBQUNBQUNBQUJRQ2dCQUFBQUFBQUFBUUFCQVFBQUFBQUFBQUFBQUFBS0FBQUFJSUFBQUFBSUFBQUFDUUFBQUFBQUFBQUFBQWdBQUFrQUFDQUFBQUFBQUFBQUFBQ0NBQUpJQUFBQUFBQUFBQUFRQUFBQUVDQUFBUUFBQUNCQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyODEsImV4cCI6MTc4MjEzNzA4MX0.gCHIpEa1DhhE4uMfBN-jZEplWwc9YaHaYqHtY82pQ8A)

### 字符集

![](https://pingcode.yasdb.com/atlas/files/public/673997008970c2af4f52b67d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQkFBQUFDQUFBQUJCQUFBQUFBQUFBQUFBQUNBQUNBQUJRQ2dCQUFBQUFBQUFBUUFCQVFBQUFBQUFBQUFBQUFBS0FBQUFJSUFBQUFBSUFBQUFDUUFBQUFBQUFBQUFBQWdBQUFrQUFDQUFBQUFBQUFBQUFBQ0NBQUpJQUFBQUFBQUFBQUFRQUFBQUVDQUFBUUFBQUNCQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyODEsImV4cCI6MTc4MjEzNzA4MX0.gCHIpEa1DhhE4uMfBN-jZEplWwc9YaHaYqHtY82pQ8A)

字符集有三个：服务端字符集/客户端字符集/文件字符集。所有的字符集转换交给客户端，客户端在AckConn中拿到服务端字符集。

**服务端**  ：服务端数据持久化的字符集属性。包数据是服务端的字符集。

**客户端**  ：客户端获取数据：将服务端字符集转换成客户端的。客户端推送数据：客户端字符集转换成服务端。

**文件**  ：文件自身的字符集。

元数据的导入导出：为了减少转换，统一将三个字符集属性设置成一致。即：文件字符集 == 客户端字符集 == 服务端字符集。

csv导出：客户端字符集由$YASDB_HOME/client/yasc_env.ini配置。不配置，使用默认值：win-gbk，linux-utf8。导出文件中，以客户端的字符集格式存储。

#   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

|  
|  
|  
|
|---|---|---|
|性能|- EXP侧：
    - EXP并行
    - 可考虑一次查询多个元数据，本地解析元数据。
- 协议
    - 导出数据：开启server 流推送
- server端查询性能
    - 视图
|  
|


## Attachments:



 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  




 (image/png)  
