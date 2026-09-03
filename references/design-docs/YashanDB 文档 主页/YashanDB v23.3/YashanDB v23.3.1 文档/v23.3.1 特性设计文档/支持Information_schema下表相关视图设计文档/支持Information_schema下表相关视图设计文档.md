Created by 李子怡, last modified on 六月 18, 2024

IR：    [YASHAN-925 【mysql兼容】支持特定的视图&系统表](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2ed? #YASHAN-925  【mysql兼容】支持特定的视图&系统表)  

SR:     [YDBRD-26295 支持Information_schema下表相关视图](https://pingcode.yasdb.com/pjm/items/66192b18fd997db58ad8a611)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#1-overview%E6%A6%82%E8%BF%B0)  

在原有的mysql框架之上，适配相关的系统视图。记录MySQL中的元数据信息。information_schema是一个虚拟数据库，物理上并不存在相关的目录和文件。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1.    [COLUMNS](https://conf.yasdb.com/display/~liziyi/COLUMNS)    ：存储表中所有列的信息，包括列名称、数据类型、是否允许为空、默认值等。

2.    [PARTITIONS](https://conf.yasdb.com/display/~liziyi/PARTITIONS)     ：存储数据库中分区表的信息。

3.    [STATISTICS](https://conf.yasdb.com/display/~liziyi/STATISTICS)     ：存储表的索引和统计信息，包括索引名称、索引类型、列名称、唯一性等。

4.    [TABLES](https://conf.yasdb.com/display/~liziyi/TABLES)     ：存储数据库中所有表的信息，包括表名称、所属模式、表类型（如基本表、视图等）等。

5.    [VIEWS](https://conf.yasdb.com/display/~liziyi/VIEWS)     ：存储数据库中所有视图的信息。         

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

功能限制：mysql模式暂不支持创建分区表，(PARTITIONS表的正确性，可以通过yashan模式创建分区表后验证）

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. create database 后 mysql兼容模式下能正常查询到这些information_schema系统视图。
1. create /alter / drop table 后查询tables, columns 中的内容是否满足预期 (mysql模式暂不支持创建分区表)。
1. create /alter  / drop view 后查询 views 中的内容是否满足预期。
1. create /alter / drop index 后查询 statistics 中的内容是否满足预期。
1. 表注释关注tables的TABLE_COMMENT字段， 列注释关注columns 中的COLUMN_COMMENT字段。


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

待自增列完成后，关注tables表的auto_increment属性

## Comments:

|  [](null)  ,基于系统表实现,Posted by liziyi at 六月 18, 2024 16:23|
|---|
