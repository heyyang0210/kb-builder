Created by 韩晓盼 on 五月 14, 2024

IR：    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b078](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b078)    ?    
  #YASHAN-296 支持overlaps函数

SR：    [https://pingcode.yasdb.com/pjm/items/6618d27efd997db58ad80245](https://pingcode.yasdb.com/pjm/items/6618d27efd997db58ad80245)    ?    
  #YDBRD-26130 支持overlaps函数

# 1.   **概述**

本需求设计范围是支持overlaps函数  。

# 2.   **需求分析**

**1、OVERLAPS函数介绍**

- **定义**


OVERLAPS函数  判断两个时间段是否有重叠。当两个时间段有重叠时，函数返回`TRUE`，否则返回`FALSE`。

- **语法**


  `overlaps::= "(" start_date1 "," end_date1 ")" overlaps "(" start_date1 "," end_date1 ")"`  

![](https://conf.yasdb.com/download/attachments/150602494/image2024-4-9_9-38-20.png?version=1&modificationDate=1712626700000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFCQUFBRUFBQWdBQUFBQkFJQUFnU0FBRUFBQUlBQkFBQUFBQkFBQUFBQUVBWUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBSUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxOTYsImV4cCI6MTc4MjMxNTk5Nn0.1nVjXmf9sOy7B8190CgfW1kUqlKzDMV_SfmgM1qnuxw)

- **规格与约束**


      1、  **入参格式限制**  ：函数前后必须有值，且前后入参个数必须各为2，其余均报错  ；

      2、  **输入类型限制**  ：入参类型只能为DATE、TIMESTAMP、TIME，其余类型均报错，包括隐式转换；

      3、  **入参值限制**  ：DATE（  0001-01-01 00:00:00 ~ 9999-12-31 23:59:59  ）、TIMESTAMP（  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999  ）、TIME（  00:00:00.000000 ~ 23:59:59.999999  ），其余报错；

      4、  **表达式限制**  ：前后四个表达式的类型必须保持一致，其余报错；

      5、  **输出类型限制**  ：返回类型为bool类型，为false或true；

      6、  **null**  ：单边部分为null场景，不报错  ；单边/双边全为null场景，报错。

  


**2、需求来源**

需求来源：    
  国信证券--融选适配    
    
  场 景：    
  1、  判断两个时间段是否有重叠    
    
  需求描述：    
  支持overlaps函数，判断两个时间段是否有重叠    
    
  需求范围：    
  1、单机、分布式和集群    
  2、行表、列表

  


**3、功能分析**

判断两个时间段是否有重叠。当两个时间段有重叠时，函数返回`TRUE`，否则返回`FALSE`  ；

与Oracle差异：

|Description|Example|YashanDB|Oracle|结论|
|---|---|---|---|---|
|数据类型time|select 1 from dual where (cast('17:34:52' as time), cast('18:34:52' as time)) overlaps (cast('18:34:52' as time), cast('19:34:52' as time));|支持time|![](https://pingcode.yasdb.com/atlas/files/public/67396d018970c2af4f520fc9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFCQUFBRUFBQWdBQUFBQkFJQUFnU0FBRUFBQUlBQkFBQUFBQkFBQUFBQUVBWUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBSUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxOTYsImV4cCI6MTc4MjMxNTk5Nn0.1nVjXmf9sOy7B8190CgfW1kUqlKzDMV_SfmgM1qnuxw)|报错，oracle不支持time类型|
|单边全null场景|--2个null,select 1 from dual where (null, null) overlaps (date'2024-04-17', date'2024-04-18');,select 1 from dual where (date'2024-04-16', date'2024-04-17') overlaps (null, null);,--3个null,select 1 from dual where (null, null) overlaps (date'2024-04-17', null);,select 1 from dual where (null, date'2024-04-17') overlaps (null, null);,--4个null,select 1 from dual where (null, null) overlaps (null, null);|也报错？|![](https://pingcode.yasdb.com/atlas/files/public/67396d01a1ad9a3311dc8e3a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFCQUFBRUFBQWdBQUFBQkFJQUFnU0FBRUFBQUlBQkFBQUFBQkFBQUFBQUVBWUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBSUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxOTYsImV4cCI6MTc4MjMxNTk5Nn0.1nVjXmf9sOy7B8190CgfW1kUqlKzDMV_SfmgM1qnuxw)|oracle均报错；,yashandb与oracle保持一致|
|null与空串’‘|select 1 from dual where (null, date'2024-04-17') overlaps (date'2024-04-17', date'2024-04-18');,select 1 from dual where (’‘, date'2024-04-17') overlaps (date'2024-04-17', date'2024-04-18');|null与空串’‘一致，不报错|![](https://pingcode.yasdb.com/atlas/files/public/67396d018970c2af4f520fcb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFCQUFBRUFBQWdBQUFBQkFJQUFnU0FBRUFBQUlBQkFBQUFBQkFBQUFBQUVBWUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBSUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxOTYsImV4cCI6MTc4MjMxNTk5Nn0.1nVjXmf9sOy7B8190CgfW1kUqlKzDMV_SfmgM1qnuxw)|yashandb中null和空串''，都表示成null，所以均不报错；,oracle中null与空串’‘不一致，空串’‘报错，null不报错|
|投影列|select (date'2024-04-16, date'2024-04-17') overlaps (date'2024-04-17', date'2024-04-18') from dual;|返回false|![](https://pingcode.yasdb.com/atlas/files/public/67396d028970c2af4f520fcd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFCQUFBRUFBQWdBQUFBQkFJQUFnU0FBRUFBQUlBQkFBQUFBQkFBQUFBQUVBWUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBSUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxOTYsImV4cCI6MTc4MjMxNTk5Nn0.1nVjXmf9sOy7B8190CgfW1kUqlKzDMV_SfmgM1qnuxw)|yashandb支持bool类型，所以该函数可以用在投影列；,Oracle不支持bool类型，该函数用在投影列，会报错|


参考：    [Overlaps 特性调研 - 陈秋富 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150602494)  

  [YDBRD-26130 Overlaps 特性开发设计文档 - 陈秋富 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150607657)  

# 3.   **测试设计方法**

使用边界值，等价类，场景分析等测试方法。

如函数值测试中使用了边界值测试，非法入参类型测试使用了等价类测试，函数位置测试使用了场景分析法。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

![](https://pingcode.yasdb.com/atlas/files/public/67396d028970c2af4f520fce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFCQUFBRUFBQWdBQUFBQkFJQUFnU0FBRUFBQUlBQkFBQUFBQkFBQUFBQUVBWUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBSUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxOTYsImV4cCI6MTc4MjMxNTk5Nn0.1nVjXmf9sOy7B8190CgfW1kUqlKzDMV_SfmgM1qnuxw)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


附件：

[YDBRD-26130 支持overlaps函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDA4OTcwYzJhZjRmNTIwZmJiIiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.oid3k9NQujQgR6FTDW8RLjy-wCisrgVsIhQJ3I5LcE0)

# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[YDBRD-26130 支持overlaps函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDA4OTcwYzJhZjRmNTIwZmJiIiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.oid3k9NQujQgR6FTDW8RLjy-wCisrgVsIhQJ3I5LcE0)

 (application/x-xmind)    


[image2024-4-17_18-7-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDBhMWFkOWEzMzExZGM4ZTJiIiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.Hlc0BimPPeDObNMUeqTydY3znhm7dFnrhhHpvE3AijE)

 (image/png)    


[image2024-4-16_17-52-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDE4OTcwYzJhZjRmNTIwZmJmIiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.HA_Hd7WsBOursdeXhkiixH6mnUFsWq_T1OQlvX-NO68)

 (image/png)    


[image2024-4-16_17-51-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDFhMWFkOWEzMzExZGM4ZTJlIiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.4O1ayeiQUHQS3Q-X7fB6N4Ly8JHPuWOTd9iMg6Vs7Mg)

 (image/png)    


[image2024-4-16_17-37-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDFhMWFkOWEzMzExZGM4ZTMyIiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.jRvVPPGNO18Jf3kqbw2BAp0oLVdWXItIZuTPi7AQ8wY)

 (image/png)    


[image2024-4-7_9-58-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDFhMWFkOWEzMzExZGM4ZTMzIiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.jHYYUDeFRCZ4kr2b2SM12z4QMZUfqBtXxS3M80f3dF8)

 (image/png)    


[image2024-4-7_10-16-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDE4OTcwYzJhZjRmNTIwZmM1IiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.9duZ6s_W5DspoczmAYvPpOmflzNlm_txyHRel0WntpQ)

 (image/png)    


[image2024-4-7_10-16-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDFhMWFkOWEzMzExZGM4ZTM1IiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.-QwBVFScDiV0jQ739ztNZyASYzTWVlloPNw0GTseknQ)

 (image/png)    


[230157344063991.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDFhMWFkOWEzMzExZGM4ZTM3IiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.eM5cdPvQ0dW5_sbdJWeOIESz3TuEoUyhAHQ5JsAMT4k)

 (image/png)    


[image2024-4-7_17-4-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDFhMWFkOWEzMzExZGM4ZTM4IiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTk2LCJleHAiOjE3ODIzOTE1OTZ9.X5asiZsNBRpNsnXD_Q-rVtKdU4E1VN1K_8kPgFkqQIw)

 (image/png)    
