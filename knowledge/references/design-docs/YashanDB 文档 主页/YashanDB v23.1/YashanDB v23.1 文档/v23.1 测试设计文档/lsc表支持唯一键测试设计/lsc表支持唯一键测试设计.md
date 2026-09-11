Created by 马文英, last modified by  李攀 on 十一月 09, 2023

### 1.   **概述**

SR：    [YDBRD-14145](https://jira.yasdb.com/browse/YDBRD-14145?src=confmacro)    -  优化器适配LSC唯一键  完成

开发设计：    [LSC支持唯一键方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=122075474)  

### 2.   **需求分析**

LSC表支持唯一键，

优化器支持生成走索引扫描和快速索引扫描的计划，索引扫描不支持回表

INDEX_FULL_SCAN

INDEX_FAST_FULL_SCAN

INDEX RANGE SCAN

INDEX RANGE SCAN DESCENDING

INDEX FULL SCAN DESCENDING

FULL INDEX SCAN(MIN/MAX)

INDEX UNIQUE SCAN

唯一索引创建方式

CREATE TABLE YDBRD12905_UNIQUE_STORAGE_01(c1 INT  ** **  **CONSTRAINT YDBRD12905_PK01 primary key**  , c2 varchar(80)    **CONSTRAINT YDBRD12905_PK02 unique**   ,c3 date);

|支持特性名称|不支持特性名|
|:---|:---|
|建表指定唯一约束（create table）|add constraint using index语法|
|添加唯一性约束（alter table add constraint）|索引语法（create/alter/drop index）|
|修改唯一性约束（alter table modify constraint）|disable primary key cascade keep index|
|删除唯一性约束（alter table drop constraint）|分布式场景不支持enable/disable constraint语法|
|约束指定形式：行内，inline_constraint|分布式场景不支持modify constraint语法|
|约束指定形式：行外，out_of_line_constraint|  
|
|primary key语法（行内、行外）|  
|
|分布式形态，分布式下唯一键必须是分布键的一部分|  
|
|创建的index默认是invisible的|  
|
|disable primary key cascade drop index|


测试对象分类

|场景分类|  
|  
|  
|
|---|---|---|---|
|索引类型|唯一索引|  
|  
|
|  
|主键|  
|  
|
|  
|  
|  
|  
|
|索引列的数据类型|数值型|  
|  
|
|  
|字符型|  
|  
|
|  
|时间类型|  
|  
|
|  
|大对象|  
|  
|
|  
|  
|  
|  
|
|索引属性|可用|  
|  
|
|  
|不可用|  
|  
|
|  
|  
|  
|  
|
|算子|全索引扫描|  
|  
|
|  
|快速索引扫描|  
|  
|
|  
|  
|  
|  
|
|算子组合|索引扫描与其他算子的结合使用|  
|  
|
|  
|join|  
|  
|
|  
|排序|  
|  
|
|  
|分组|  
|  
|
|  
|聚合|  
|  
|
|  
|集合操作|union,union all    
    
|  
|
|投影列|全部属于索引|  
|  
|
|  
|部分属于索引|不走索引扫描|  
|
|  
|与索引一一对应|  
|  
|
|  
|跨索引（表中有多个唯一索引）|  
|  
|
|  
|  
|  
|  
|
|filter|全部属于索引|  
|  
|
|  
|部分属于索引|不走索引扫描|  
|
|  
|与索引一一对应|  
|  
|
|  
|谓词下推|  
|  
|
|  
|跨索引（表中有多个唯一索引）|  
|  
|
|  
|  
|  
|  
|
|统计信息|lsc支持索引后补测统计信息|  
|  
|
|  
|动态采样|  
|  
|
|子查询里面|  
|  
|  
|
|update |  
|  
|  
|
|delete|  
|  
|  
|
|create as select|  
|  
|  
|
|cte|  
|  
|  
|
|index+nestedloop|  
,  
|  
|  
|
|表类型|普通列表|  
|  
|
|  
|分区表,分区索引local?|  
|  
|
|  
|  
|  
|  
|
|部署类型|分布式|分不建是唯一索引的子集|  
|
|  
|单机|  
|  
|
|lsc表冷热数据|  
|  
|  
|
|建表时加order key|  
|  
|  
|
|hint|no_index|  
|  
|
|  
|index|  
|  
|
|  
|full|  
|  
|


### 3.   **测试设计方法**   

场景覆盖

### 4.   **详细测试设计**

|  
|对象|查询|  
|备注|
|---|---|---|---|---|
|1|  
|投影列|filter|  
|
|2|建不同数据类型（数值，字符，时间）的单列（唯一约束/主键约束）|单投影列和索引完全匹配|无类型转换|  
|
|3|  
|投影列是函数，函数参数是索引列|  
|  
|
|4|  
|  
|有类型转换|  
|
|5|建不同数据类型的多列（唯一约束/主键约束），多列类型相同|多投影列和索引完全匹配|  
|  
|
|6|  
|投影列是索引列的子集（首列，非首列）|  
|  
|
|7|创建组合唯一键索引|投影列包含全部索引列|filter是全部索引列|  
|
|8|  
|  
|filter是部分索引列，不含首列|  
|
|9|  
|投影列是唯一键里面部分，但是与filter列一样|filter是部分索引列，含首列|  
|
|10|  
|投影列是组合索引列部分|  
|  
|
|11|  
|  
|filter 含非索引列|不走索引扫描|


### **5. 测试用例设计**

### 6.   **测试框架设计**

### 7.   **测试环境说明**

## Attachments:

[image2023-8-9_10-16-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjA4OTcwYzJhZjRmNTFmN2I2IiwicmVmX2lkIjoiNjczOTY5NjA1OTNmOTljOWZmMjM0ZGU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTc0LCJleHAiOjE3ODIyMTMzNzR9.C0keSdg58_GcGqFT1V-O8Z2t20r8qRyCogZhNWrcJkA)

 (image/png)    
