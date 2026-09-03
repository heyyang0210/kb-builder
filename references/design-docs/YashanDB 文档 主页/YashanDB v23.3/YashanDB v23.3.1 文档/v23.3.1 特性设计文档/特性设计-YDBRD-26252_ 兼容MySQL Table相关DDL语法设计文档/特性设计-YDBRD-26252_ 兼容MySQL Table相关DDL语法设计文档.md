Created by 李子怡 on 八月 27, 2024

IR:       [YASHAN-934 【mysql兼容】（功能&语法）支持表的特定特性](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f6? #YASHAN-934  【mysql兼容】（功能&语法）支持表的特定特性)  

SR：    [YDBRD-26252 兼容MySQL Table相关DDL语法](https://pingcode.yasdb.com/pjm/items/6619084afd997db58ad8820e? #YDBRD-26252 兼容MySQL Table相关DDL语法)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#1-overview%E6%A6%82%E8%BF%B0)  

在原有的mysql table框架之上，适配相关的表选项列数据类型及属性  。（CREATE TEMPORARY TABLE不支持，CREATE TABLE LIKE不支持）

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

【表选项】

engine/character set/collate/row_format/comment

指定表的ENGINE/CHARACTER SET/COLLATE/ROW_FORMAT/COMMENT属性

其中：

- ENGINE: 表示存储引擎
- CHARACTER SET: 表示字符集（  charset 是 character set 的简写  ）
- COLLATE: 表示字符集排序  （CHARACTRE SET 与 COLLATE 有对应关系，不满足条件会报错  eg: “COLLATION 'utf8mb4_bin' is not valid for CHARACTER SET 'ascii'”）
- ROW_FORMAT: 表示创建和管理表的存储格式 （可取值：DEFAULT|DYNAMIC|FIXED|COMPRESSED|REDUNDANT|COMPACT）
- COMMENT: 表示注释 (Comment for table *** is too long (max = 2048))


![](https://pingcode.yasdb.com/atlas/files/public/67396ed7a1ad9a3311dc9a41/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQVFBZ0FBQUFBQUFFQUFBQUVBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQzNjcsImV4cCI6MTc4MjQ1NTE2N30.qAe7J0otZmPyUUv46R7IwPRmO54cUszepb5Hqi3BJtQ)

```
CREATE TABLE 表名(
.....
) ENGINE = [engine_name] DEFAULT CHARSET = [charset_name] COLLATE = [collate_name] ROW_FORMAT = [row_format]

CREATE TABLE 表名(
.....
) CHARACTER SET [charset_name] COLLATE [collate_name]


```

  


【列数据类型和属性】

collate/character set/comment

指定列的collate/character set/comment属性（collate/character set如果列级别没有设置，继承表级别的设置）

其中：

- character set: 表示字符集 (不能简写)
- collate: 表示字符排序
- comment: 表示注释(最长1024字节：Comment for field *** is too long (max = 1024))


![](https://pingcode.yasdb.com/atlas/files/public/67396ed78970c2af4f521bcd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQVFBZ0FBQUFBQUFFQUFBQUVBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQzNjcsImV4cCI6MTc4MjQ1NTE2N30.qAe7J0otZmPyUUv46R7IwPRmO54cUszepb5Hqi3BJtQ)

alter table change ：  **ALTER TABLE**   table_name   **CHANGE**   old_column_name  new_column_name column_definition

                                  可以重命名列并更改定义（change = modify + rename）

                                  可以使用FIRST和AFTER对列进行重新排序（暂不支持）

                                  修改列的数据类型时，需保证列中值空（column to be modified must be empty）

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#3-interfaces%E6%8E%A5%E5%8F%A3)  

```
函数：
CodResult myParseCreateTable(AnlParser* parser, LangWord* word);&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;创建表
CodResult myParseAlterTable(AnlParser* parser, LangWord* word);&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 修改表
CodResult myVerifyAlterTable(AnlVerifier* vrfr, CodPointer ctx);                                      
CodResult parseTableColAttrs(AnlParser* parser, LangWord* word, ColumnDef* colDef, List* consDefList, CodUint32* clauses);     列属性                

AlterTableAction 新增：	
ALTER_TABLE_CHANGE_COL		修改列的属性

```

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

|支持的mysql兼容语法|映射的yashan SQL语句类型|
|---|---|
|create table|SQL_CREATE_TABLE|
|alter table|SQL_ALTER_TABLE|


- TABLE相关DDL语法仅做语法兼容。
- charset名称和collation名称，支持使用单引号、双引号、反引号括起；table名称，列名称 支持用反引号括起。
- ROW_FORMAT 可取值限定为：DEFAULT|DYNAMIC|FIXED|COMPRESSED|REDUNDANT|COMPACT。
- CHARACTER SET与COLLATE 有对应关系，不满足要求会报错。（详见：表一）
- CHARACTER SET与 COLLATE属性只针对字符类型数据列，如果列为非字符类型，设置这两个属性会报错。
- 列属性comment 最长1024个字节, 表属性comment 最长 2048个字节。
- ALTER TABLE CHANGE的约束与现有的ALTER TABLE MODIFY的约束一致（详见：    [alter table modify column](https://conf.yasdb.com/display/~machengfei/2022/03/28/alter+table+modify+column)    ）


表一：  CHARACTER SET与COLLATE 的一对多对应关系(参考：    [mysql字符集设置](https://conf.yasdb.com/pages/viewpage.action?pageId=150617920)    )

|CHARACTER SET|COLLATE |DEFAULT COLLATION|
|---|---|---|
|ASCII|ASCII_GENERAL_CS,ASCII_GENERAL_CI|ASCII_GENERAL_CI|
|GBK|GBK_GENERAL_CS,GBK_GENERAL_CI|GBK_GENERAL_CI|
|UTF8|UTF8_GENERAL_CS    
  UTF8_GENERAL_CI|UTF8_GENERAL_CI|
|LATIN1|ISO88591_GENERAL_CS,ISO88591_GENERAL_CI|ISO88591_GENERAL_CI|
|GB18030|GB18030_GENERAL_CS    
  GB18030_GENERAL_CI|GB18030_GENERAL_CI|
|UTF8MB4|UTF8MB4_BIN,UTF8MB4_GENERAL_CI|UTF8_GENERAL_CI|
|UTF8MB3|UTF8MB4_BIN,UTF8MB4_GENERAL_CI|UTF8_GENERAL_CI|


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. create table/ alter table 表选项ENGINE/CHARACTER SET/COLLATE/ROW_FORMAT属性的排列组合
1. 列选项collate/character set/comment的排列组合。
1. 表选项有无“=”都支持，列属性没有“=”。
1. 列属性comment 最长1024个字节，  表属性comment 最长 2048个字节  。
1. ALTER TABLE CHANGE 支持对列属性comment的修改。


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Attachments: