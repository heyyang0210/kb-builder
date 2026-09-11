Created by 邬建川, last modified on 十一月 13, 2024

##   [1. 总述](#1-总述)  

  [https://pingcode.yasdb.com/pjm/items/670721a4e489dd0868f31bca](https://pingcode.yasdb.com/pjm/items/670721a4e489dd0868f31bca)    ?

#YDBRD-33655 SQL执行支持bulkload导数批量执行

###   [1.1 需求来源](#11-需求来源)  

用户反馈，性能问题。需要提高分布式insert的性能。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

功能列表

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|性能|分布式insert 列表|||||
|性能|单机insert 列表|||||


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|配置参数|batch_error_process_size|batch error执行cn/单机 一次处理批量数据的内存上限|是|


##   [3. 规格与约束](#3-规格与约束)  

yasldr导入的批量数最大为64k

##   [4. 特性](#4-特性)  

![](https://pingcode.yasdb.com/atlas/files/public/6739a68da1ad9a3311dd60ba/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFDQUFBQUFBQUFDQUFBQUFBQUFBUUFBQUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFFUUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2NzYsImV4cCI6MTc4MjQ2NzQ3Nn0.DIQ5dFAmtUPeGMUJLfbko9r-U_Y9nKsbs7QdohsNRY8)

###   [4.1 CN上数据按节点拆分](#41-cn上数据按节点拆分)  

cn数据按节点拆分，失败reinsert流程不需要重新读数据。简化了数据skip的流程。

每一批数据读完直接进行split，减少了循环次数。

![](https://pingcode.yasdb.com/atlas/files/public/6739a68da1ad9a3311dd60bb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFDQUFBQUFBQUFDQUFBQUFBQUFBUUFBQUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFFUUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2NzYsImV4cCI6MTc4MjQ2NzQ3Nn0.DIQ5dFAmtUPeGMUJLfbko9r-U_Y9nKsbs7QdohsNRY8)

###   [4.2 单机/DN 数据按分区拆分/插入](#42-单机dn-数据按分区拆分插入)  

目前单机/DN的批量插入是多次调用execSingleInsert接口，函数调用次数多，dataset多次构造，release的开销大。

改为按分区切分后，调用一次singleInsert,dataSet每一个分区的数据构造一次然后批量插入。减少了函数调用开销。dataset多次构造开销。

![](https://pingcode.yasdb.com/atlas/files/public/6739a68d8970c2af4f52e268/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFDQUFBQUFBQUFDQUFBQUFBQUFBUUFBQUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFFUUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2NzYsImV4cCI6MTc4MjQ2NzQ3Nn0.DIQ5dFAmtUPeGMUJLfbko9r-U_Y9nKsbs7QdohsNRY8)

###   [4.3](#43)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5.未来规划](#5未来规划)  

## Attachments:

[Lru cahe struct.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWE2OGQ4OTcwYzJhZjRmNTJlMjY0IiwicmVmX2lkIjoiNjczOWE2OGQ1OTNmOTljOWZmMjRjODAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2Njc1LCJleHAiOjE3ODI1NDMwNzV9._DpE_NEOAYNQI-p4RN09Zosgn40h6eV5ZMXSelaTbU0)

 (image/jpeg)    


[Lru cache.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWE2OGRhMWFkOWEzMzExZGQ2MGI4IiwicmVmX2lkIjoiNjczOWE2OGQ1OTNmOTljOWZmMjRjODAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2Njc1LCJleHAiOjE3ODI1NDMwNzV9.3my8xHRvZ6CUbjlqg2oe9zRAqpO5BmLfvBmRZvRfNHg)

 (image/jpeg)    


[内存溢出.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWE2OGQ4OTcwYzJhZjRmNTJlMjY1IiwicmVmX2lkIjoiNjczOWE2OGQ1OTNmOTljOWZmMjRjODAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2Njc1LCJleHAiOjE3ODI1NDMwNzV9.cBxiljgy6rFmDbEY3FpM0RVnFrG5ZugfKrBR5zbl-BM)

 (image/jpeg)    
