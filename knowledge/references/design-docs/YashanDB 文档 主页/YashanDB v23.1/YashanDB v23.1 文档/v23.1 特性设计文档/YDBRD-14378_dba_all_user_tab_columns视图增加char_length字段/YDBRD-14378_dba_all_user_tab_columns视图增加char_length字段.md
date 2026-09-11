Created by 钟金健, last modified on 七月 19, 2023

IR:    [YDBRD-9123](https://jira.yasdb.com/browse/YDBRD-9123?src=confmacro)    -  支持user_tab_columns增加char_length字段  完成

SR    [YDBRD-14378](https://jira.yasdb.com/browse/YDBRD-14378?src=confmacro)    -  dba_/all_/user_tab_columns视图增加char_length字段  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

该特性是在dba_tab_cols/dba_tab_colums、all_tab_cols/all_tab_colums、user_tab_cols/user_tab_colums视图上添加char_length字段，描述列定义的字符长度信息。

该字段的原始数据来源于系统表col$的char_len字段，这个字段信息对应于oracle的col$ spare3字段

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

## char_length字段基本描述：

char_length字段描述列定义时的原始字符长度信息

- 对于char/varchar/nvarchar/nchar类型，char_length信息有实际含义。


- 对于其他数据类型，char_length字段应该是0


## 具体场景

|列定义|char_length字段|data_length字段（与char_length字段区分）（字符集编码为UTF8，国家字符集编码为UTF16）|备注|
|---|---|---|---|
|char(n)|n|n|  
|
|char(n char)|n|4 * n  （最大32000）|  
|
|varchar(n)|n|n|  
|
|varchar(n char)|n|4 * n（最大32000）|  
|
|nchar(n)|n|2 * n（最大32000）|现版本未支持，但是对应需求已在开发阶段，可以添加用例预埋|
|nvarchar(n)|n|2 * n（最大32000）|现版本未支持，但是对应需求已在开发阶段，可以添加用例预埋|


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

建表，查询视图，检查不同类型的列定义在对应视图的char_length字段上是否符合预期

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  