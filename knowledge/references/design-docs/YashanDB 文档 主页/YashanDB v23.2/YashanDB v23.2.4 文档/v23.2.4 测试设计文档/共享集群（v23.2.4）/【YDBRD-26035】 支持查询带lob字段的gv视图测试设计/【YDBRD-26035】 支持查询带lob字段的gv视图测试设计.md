Created by 徐卓, last modified on 七月 24, 2024

# 1. 概述

当前识别到GV$SQLAREA，GV$SQL，GV$SQLSTATS视图中的sql_fulltext字段为CLOB类型，因集群未支持LOB字段的跨节点传输，目前只能支持小于32KB大小的字符，为了能够显示更复杂的SQL，支持以上视图中的LOB数据跨节点传输。

开发设计文档：    [YDBRD-26035 支持查询带lob字段的gv视图](159434568.html)  

*IR链接：*  *  *    [https://pingcode.yasdb.com/pjm/items/6616385ffd997db58ad6b9fb](https://pingcode.yasdb.com/pjm/items/6616385ffd997db58ad6b9fb)    *?*  *  
*  *#YDBRD-26035 支持查询带lob字段的gv视图*

*SR链接：*  *  *    [https://pingcode.yasdb.com/pjm/items/664b0b56288e1978208e7a3a](https://pingcode.yasdb.com/pjm/items/664b0b56288e1978208e7a3a)    *?*  *  
*  *#YDBRD-27456 开发任务：支持查询带lob字段的gv视图*  *  
*

# 2. 需求分析

## 2.1 功能点分析

- 支持GV$SQLAREA，GV$SQL，GV$SQLSTATS视图大于32KB大小的字符不截断显示
- 支持DV$SQLAREA，DV$SQL，DV$SQLSTATS视图大于32KB大小的字符不截断显示


## 2.2 应用场景

- 当前识别到GV$SQLAREA，GV$SQL，GV$SQLSTATS视图中的sql_fulltext字段为CLOB类型，因集群未支持LOB字段的跨节点传输，目前只能支持小于32KB大小的字符，为了能够显示更复杂的SQL，支持以上视图中的LOB数据跨节点传输。


## 2.3 规格约束

1、部署形态：集群、分布式    
    


# 3. 详细测试设计

## 3.1 测试设计方法

本次测试设计主要采用边界值、场景法、错误推测法。

本SR主要支持GV$SQLAREA，GV$SQL，GV$SQLSTATS、DV$SQLAREA，DV$SQL，DV$SQLSTATS六个视图大于32KB大小字符不截断显示，主要采用边界值方法验证32K-2M大小间的字符不截断显示。

并发select操作及跨实例/CN视图查询操作，验证接口是否正常，无卡住及core现象

验证并发过大，sql被淘汰场景

  


## 3.2 详细测试设计

![](https://pingcode.yasdb.com/atlas/files/public/67396db08970c2af4f521495/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA3NDIsImV4cCI6MTc4MjMyMTU0Mn0.olCec4rZIqcWGH0ND1cNW6mojXkxYaNNMuIEFY8J-wY)

  


|  
|场景|详细步骤|预期结果|备注|结论|
|:---|:---|:---|:---|:---|:---|
|1|拦截场景|执行create table as select、insert into select语句，查询对应接口|无create table as select、insert into select信息打印|  
|  
|
|2|gv-查询语句大小测试|编写查询语句大于32k，查询对应接口|成功查询，无截断显示|主备集群场景+单机部署两实例场景|  
|
|3|gv-查询语句大小测试|编写查询语句大于2M，查询对应接口|成功查询，截断显示|  
|  
|
|4|gv-查询语句大小测试|编写查询语句大于32k小于2M，查询对应接口|成功查询，无截断显示|  
|  
|
|5|dv-查询语句大小测试|编写查询语句大于32k，查询对应接口|成功查询，无截断显示|  
|  
|
|6|dv-查询语句大小测试|编写查询语句大于2M，查询对应接口|成功查询，截断显示|  
|  
|
|7|dv-查询语句大小测试|编写查询语句大于32k小于2M，查询对应接口|成功查询，无截断显示|  
|  
|
|8|gv-查询带特殊字符测试|where条件包含：%……&￥#@！等特殊符号    
  、”/'''/’    
  中英文、数字|成功查询，显示正确|  
|  
|
|9|dv-查询带特殊字符测试|where条件包含：%……&￥#@！等特殊符号    
  、”/'''/’    
  中英文、数字|成功查询，显示正确|  
|  
|
|10|gv-纯并发|并发select操作及跨实例/cn视图查询操作|  
|  
|  
|
|11|gv-并发带kill|并发业务操作带kill db/ycs|  
|  
|  
|
|12|gv-高并发，sql淘汰|  
|  
|  
|  
|
|13|dv-纯并发|并发select操作及跨实例/cn视图查询操作|  
|  
|  
|
|14|dv-并发带kill|并发业务操作带kill db/ycs|  
|  
|  
|
|15|dv-高并发，sql淘汰|  
|  
|  
|  
|


## 3.3 是否涉及DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|并发测试已经考虑，主要是业务的并发，用HA框架实现|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|不涉及|
|HA|覆盖集群主备场景，用HA框架实现|
|压力|不涉及，本SR不涉及DB业务|
|性能|不涉及，本SR不涉及DB业务|
|可维护性|本SR所有用例均会自动化看护|


# 4. 测试用例

开发门槛用例：    
  测试用例：

  


## **5、测试框架设计**

本次测试使用HA框架实现

## **6、测试环境说明**

|服务器|双机磁阵|
|:---|:---|
|操作系统|Linux x86/arm|
|部署|  
|


## **7. 工作量评估**

工作量：7人天

  


## Attachments:

[image2024-4-25_9-51-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjBhMWFkOWEzMzExZGM5MzA4IiwicmVmX2lkIjoiNjczOTZkYjA1OTNmOTljOWZmMjM3ZThiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNzQyLCJleHAiOjE3ODIzOTcxNDJ9.kOkN-KXeigTjdQvK07PpZ9tq1NAixBYK-VumW5or2kM)

 (image/png)    
