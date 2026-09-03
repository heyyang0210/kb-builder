Created by 易文亮, last modified by  陈瑞 on 十一月 14, 2023

# **1. 概述**

本文描述LSC/TAC列存表支持二级分区的测试设计

# **2. 需求分析**

SR：         [YDBRD-13506](https://jira.yasdb.com/browse/YDBRD-13506?src=confmacro)    -  LSC表支持二级分区  完成

开发设计：    [【Spearfish】LSC/TAC 支持二级分区方案设计](109601972.html)  

语法验证：

CREATE TABLE table_name (column_name DATATYPE,...) PARTITION BY RANGE|LIST|HASH(column_name,...) [subpartition template (subpartition_clause)](paritition_clause); 

ALTER TABLE table_name add/drop partition(part_name)|subpartition(subpartition_name);

  


功能验证：

1、  LSC/TAC支持 hash-hash, hash-list, hash-range, range-hash, range-list, range-range, list-hash, list-range, list-list 9种组合分区表的create/drop table

heap二级分区相关测试设计：    [https://conf.yasdb.com/pages/viewpage.action?pageId=107387905](https://conf.yasdb.com/pages/viewpage.action?pageId=107387905)  

2、LSC/TAC支持 hash-hash, hash-list, hash-range, range-hash, range-list, range-range, list-hash, list-range, list-list 9种组合分区表的truncate/add/drop partition/subpartition

heap二级分区相关测试设计：    [https://conf.yasdb.com/pages/viewpage.action?pageId=109589712](https://conf.yasdb.com/pages/viewpage.action?pageId=109589712)  

3、LSC/TAC支持 hash-hash, hash-list, hash-range, range-hash, range-list, range-range, list-hash, list-range, list-list 9种组合分区表数据进行insert/delete/update/select操作

heap二级分区相关测试设计：    [复制从 二级分区剪枝方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109596549)  

[二级分区支持dml.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWM4OTcwYzJhZjRmNTFmYjMzIiwicmVmX2lkIjoiNjczOTY5ZWM3MjgyMDZlZmI5MmVmOGZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMDg0LCJleHAiOjE3ODIyOTY0ODR9.5f1L3_d0sBP2H-m-05oTGpYRy8X074siqrX9P2vdp2U)

4、tac表考虑二级分区的alter index

  [heap二级分区相关测试设计：   迭代三 YDBRD-15510 【二级分区支持alter index】测试设计](113969926.html)  

5、列存二级分区外键不支持，拦截

 heap二级分区相关测试设计：      [迭代三 YDBRD-14056【二级分区支持外键约束】测试设计](112726483.html)  

其他测试点：

1、支持二级分区表空间offline/online  ；

2、LSC表考虑分区键与order key的关系  ；

3、分布式考虑分区键与分布键的关系  ；

4、TAC要考虑临时表，LSC暂不支持临时表  ；

5、分区键跟主键的关系，列存建主键，heap建外键

限制：

1、二级分区lsc表不支持建AC

2、LSC表不支持跨分区更新

3、列存不支持回收站

# **3. 测试**  **设计方法**   

  


测试设计主要采用等价类及错误推测等测试法进行设计

4.1 ddl验证

tac表增加考虑使用MMS表空间，其他包括index复用heap用例

lsc表增加考虑带order by(column_name,...) [scol]列的情况，剔除不支持的index，其他复用

  


4.2 dml验证

1）LSC表不支持跨分区更新

2）LSC表结合slice转换、slice合并

3）构造包含静态数据的情形，动静态数据update/delete

  


4.3 分区剪枝验证

复用heap表用例

4.4 分布式用例

1）考虑分布表和复制表；

2）考虑分布键做一、二级分区键

  


4.5 并发验证

LSC表在原有heap用例的前提下，结合考虑slice转换和合并

### 专项覆盖

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|/|
|一致性|是|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR/testkill|是|
|HA|/|
|压力|/|
|性能|/|
|可维护性|/|
|兼容性|/|


# 4.   **详细测试设计**

[列存支持二级分区(ydbrd13506).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWM4OTcwYzJhZjRmNTFmYjM0IiwicmVmX2lkIjoiNjczOTY5ZWM3MjgyMDZlZmI5MmVmOGZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMDg0LCJleHAiOjE3ODIyOTY0ODR9.Qax8A50_sFGf5Deta6L8ot04piBNrcDRFe3tfF--R0g)

  


# 5.   **测试用例**

  


# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[二级分区支持dml.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWM4OTcwYzJhZjRmNTFmYjMzIiwicmVmX2lkIjoiNjczOTY5ZWM3MjgyMDZlZmI5MmVmOGZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMDg0LCJleHAiOjE3ODIyOTY0ODR9.5f1L3_d0sBP2H-m-05oTGpYRy8X074siqrX9P2vdp2U)

 (application/x-xmind)    


[列存支持二级分区(ydbrd13506).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWM4OTcwYzJhZjRmNTFmYjM0IiwicmVmX2lkIjoiNjczOTY5ZWM3MjgyMDZlZmI5MmVmOGZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMDg0LCJleHAiOjE3ODIyOTY0ODR9.Qax8A50_sFGf5Deta6L8ot04piBNrcDRFe3tfF--R0g)

 (application/x-xmind)    
