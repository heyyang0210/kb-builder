Created by 贺天欢, last modified on 十二月 12, 2023

#   [YDBRD-15659](https://jira.yasdb.com/browse/YDBRD-15659)       -     dbms_metadata.get_ddl支持获取列存DDL     完成

  [YDBRD-17688](https://jira.yasdb.com/browse/YDBRD-17688)       -     dbms_metadata.get_ddl支持获取列存ddl     完成

# 1.   **概述**

- 给定一个lsc列存表，输出该表的建表create语句


# 2.   **需求分析**

### **2.1概述**

**开发设计文档：**    [DBMS_METADATA.GET_DDL(支持lsc列存表)](127643556.html)  

create table语法图：    [06-CREATE TABLE语法图](https://conf.yasdb.com/pages/viewpage.action?pageId=127642193)  

来源：    [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html#%E9%80%9A%E7%94%A8%E6%8F%8F%E8%BF%B0](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html#%E9%80%9A%E7%94%A8%E6%8F%8F%E8%BF%B0)  

![](https://pingcode.yasdb.com/atlas/files/public/673969a18970c2af4f51f998/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc4MjQsImV4cCI6MTc4MjIxODYyNH0.VWZHb-Wi7mPX0xjNqcQYYtxaSZ2J8Ld_U8nf3g_QPto)

### **2.2 语法支持情况**

**语法支持情况：**

|语句|是否支持|
|:---|:---|
|relation_properties|全部支持|
|table_properties|部分支持|
|lsc_table_properties|全部支持|
|row_movement_clause|全部支持|


**relation_properties支持情况：**

![](https://conf.yasdb.com/download/attachments/124263242/image2023-8-25_14-50-9.png?version=1&modificationDate=1692946088045&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc4MjQsImV4cCI6MTc4MjIxODYyNH0.VWZHb-Wi7mPX0xjNqcQYYtxaSZ2J8Ld_U8nf3g_QPto)

|语句|是否支持|
|:---|:---|
|column_definition|支持|
|out_of_line_constraint|支持|
|inline_constraint|支持|


注：inline_constraint情况除了NOT NULL仍使用inline_constraint，其他情况都转为out_of_line_constraint

foreign key和check不支持，因为列存不支持foreign key和check

**table_properties支持情况：**

![](https://conf.yasdb.com/download/attachments/124263242/image2023-8-25_14-54-16.png?version=1&modificationDate=1692946335133&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc4MjQsImV4cCI6MTc4MjIxODYyNH0.VWZHb-Wi7mPX0xjNqcQYYtxaSZ2J8Ld_U8nf3g_QPto)

|语句|是否支持|备注|
|:---|:---|:---|
|organization_clause|支持|  
|
|table_partition_clause|支持|  
|
|lob_clauses|支持|  
|
|logging_clause|支持|  
|
|physical_attribute_clause|部分支持|详情见下表|
|temp_table_attr_clause|不支持|不支持临时表|
|shard_distribute_clause|不支持|不支持分布式|
|parallel_clause|不支持|仅作语法兼容，无实际意义|
|cache_clause|不支持|仅作语法兼容，无实际意义|
|readonly_clause|不支持|仅作语法兼容，无实际意义|
|inmemory_clause|不支持|仅作语法兼容，无实际意义|
|table_compression|不支持|仅作语法兼容，无实际意义|
|nested_table_clauses|不支持|不支持嵌套表类型|


**physical_attribute_clause支持情况：**

![](https://conf.yasdb.com/download/attachments/124263242/image2023-8-28_15-4-36.png?version=1&modificationDate=1693206150458&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc4MjQsImV4cCI6MTc4MjIxODYyNH0.VWZHb-Wi7mPX0xjNqcQYYtxaSZ2J8Ld_U8nf3g_QPto)

|语句|是否支持|备注|
|:---|:---|:---|
|tablespace|支持|  
|
|pctfree|支持|  
|
|initrans|支持|  
|
|maxtrans|支持|  
|
|deferred_segment_creation|部分情况支持|仅支持输出table的deferred_segment_creation，不支持输出partition的，因为暂无视图可查partition的segment deferred信息|
|tablespace set|不支持|不支持分布式|
|pctused|不支持|仅作语法兼容，无实际含义|
|storage_clause|不支持|仅作语法兼容，无实际含义|


**其他一些零散的不支持的情况**

lob_clause中basicfile|securefile不支持，因为仅作语法兼容，无实际含义

**行存，lsc列存属性差异：**

普通表：

|属性|行存是否支持|列存是否支持|备注|
|:---|:---|:---|:---|
|compression (column)|不支持|支持|  
|
|compression_level (column)|不支持|支持|  
|
|compression (table)|不支持|支持|  
|
|compression_level (table)|不支持|支持|  
|
|encoding|不支持|支持|  
|
|order key|不支持|支持|  
|
|升序降序|不支持|支持|  
|
|nullFirst, nullLast|不支持|支持|  
|
|mcol_ttl|不支持|支持|  
|
|唯一性约束|支持|支持|  
|
|comment|支持|支持|  
|
|create index|支持|不支持|lsc表不支持create index索引|
|alter using index|支持|不支持|lsc表不支持create index索引|
|nested table|不支持|不支持|行表暂未实现，lsc表不支持嵌套表类型|


分区表：

|属性|行存是否支持|列存是否支持|备注|
|:---|:---|:---|:---|
|compression (column)|不支持|支持|  
|
|compression_level (column)|不支持|支持|  
|
|compression (table)|不支持|支持|  
|
|compression_level (table)|不支持|支持|  
|
|encoding|不支持|支持|  
|
|order key|不支持|支持|  
|
|升序降序|不支持|支持|  
|
|nullFirst, nullLast|不支持|支持|  
|
|mcol_ttl|不支持|支持|  
|
|唯一性约束|支持|支持|  
|
|二级分区表|支持|支持|  
|
|create index|支持|不支持|lsc表不支持create index索引|
|alter using index|支持|不支持|lsc表不支持create index索引|
|comment|不支持|不支持|分区表不支持comment|
|nested table|不支持|不支持|行表暂未实现，lsc表不支持嵌套表类型|


### 2.3规格约束

支持lsc表，不支持tac表

支持partition分区表，不支持temporary临时表。因为临时表尚不支持lsc列存

支持显示order key：通过查询ALL_SORT_KEY_COLUMNS视图，获取order key信息，并将其拼接成ddl语句：ORDER BY ("KEY1", "KEY2", "KEY3")

支持显示compression, compression_level：通过查询ALL_TABLES视图获取表的压缩编码信息：compression和compression_level列；通过查询ALL_TAB_COLS视图获取列的压缩编码信息：compression和compression_level列

支持显示encoding：通过查询ALL_TAB_COLS视图获取列的encoding编码信息：encoding列

支持显示comment：通过查询all_col_comments, all_tab_comments视图，获取comment信息并输出

支持显示deferred_segment_creation：通过查询all_tables视图，获取segment deferred字段并输出

不支持nested table嵌套表，因为lsc列存表不支持嵌套表类型

分区表不支持comment

不支持分布式

# 3.   **测试设计方法**

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. guider框架


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

|环境|测试策略|其他|
|---|---|---|
|单机HA|1、优先覆盖create语法图,2、再覆盖规格约束,3、最后覆盖场景部分|  
|
|分布式|不支持，有拦截报错|  
|


  


## Attachments:

[列存支持DBMS_METADATA.GET_DDL.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTFhMWFkOWEzMzExZGM3ODBjIiwicmVmX2lkIjoiNjczOTY5YTE3MjgyMDZlZmI5MmVmNTYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODI0LCJleHAiOjE3ODIyOTQyMjR9.VeLsMpQn3gu8iTh2EcAWpcenDoebtwh90RjttffA1Bc)

 (application/x-xmind)    


[文本用例-LSC_getddl.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTFhMWFkOWEzMzExZGM3ODBkIiwicmVmX2lkIjoiNjczOTY5YTE3MjgyMDZlZmI5MmVmNTYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODI0LCJleHAiOjE3ODIyOTQyMjR9.dtBPivi6lQ7aOglMTfC78tSx_UF0e5-I1cimcszK8Es)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
