Created by 程康, last modified on 八月 28, 2024

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

  [https://pingcode.yasdb.com/pjm/items/66bad12766228b94707e3333](https://pingcode.yasdb.com/pjm/items/66bad12766228b94707e3333)    ?    
  #YDBRD-31455 【安全】PLSQL源码加密–算法类型支持国密

###   [1.2 调研文档](#12-调研文档)  

  [存储过程加解密概要设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130154089)  

  [Oracle PL/SQL 源代码加密实战_plsql sm2加密-CSDN博客](https://blog.csdn.net/horses/article/details/109287530)  

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

1、新增客户端参数 WRAP_ALOGRITHM 默认sha1，可选 sha1，sm3，指定plsql加密方式

2、增加sha1、sm3的完整性校验

3、兼容性：

加密：

|  
|  
|
|---|---|
|老版本|sha1 ok|
|新版本|sha1 ok、sm3 ok|
|信创版本|sha1 nok、sm3 ok|


解密：

|  
|老文件|新文件|
|---|---|---|
|老实例|sha1 ok|sha1 ok，sm3 nok|
|新实例|sha1 ok|sha1 ok，sm3 ok|
|信创实例|sha1 nok|sha1 nok， sm3 ok|


##   [4. 特性](#4-特性)  

sha1 head：a000000

sm3  head：a000001

![](https://pingcode.yasdb.com/atlas/files/public/67396e088970c2af4f521665/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBZ0FBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM3MjAsImV4cCI6MTc4MjMyNDUyMH0.YgTgT7q2Dog-nEMr407peC6OyP5BX5fJtKpkgmO8iWU)

  


去除sha1后，进行完整性校验，重新对sql文本进行sha1，比对去除的str与重新hash后的str

sm3同

![](https://pingcode.yasdb.com/atlas/files/public/67396e08a1ad9a3311dc94d7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBZ0FBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM3MjAsImV4cCI6MTc4MjMyNDUyMH0.YgTgT7q2Dog-nEMr407peC6OyP5BX5fJtKpkgmO8iWU)

  


对于字符集的处理：

参考oracle将客户端字符集flag记录在plb中

在服务端解密后，对原文本进行正确的字符集转换

  


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

plsql类型：

- Package head
- Package body
- Function
- Procedure


兼容性测试：新老文件，新老实例，信创实例。

##   [6.资料设计章节](#6资料设计章节)  

增加资料说明，

##   [7.未来规划](#7未来规划)  

  


  


## Attachments:

[image2024-4-29_14-13-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDdhMWFkOWEzMzExZGM5NGQ2IiwicmVmX2lkIjoiNjczOTZlMDc1OTNmOTljOWZmMjM4MTZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNzIwLCJleHAiOjE3ODI0MDAxMjB9.NKFEVbKX8xqsy5KD62-yA4hvGht_0Y8FqFixVl7NPHA)

 (image/png)    


## Comments:

|  [](null)  ,1  、  sha1   替换   sha256 -- no    
  2  、压缩和  base64   无关    
  3  、无法排除更改加密后的  plsql  ，刚好校验过的情况    
  4  、字符集？  --   待验证,Posted by chengkang at 八月 26, 2024 11:25|
|---|
|  [](null)  ,部分加密,全部加密,再进行yaswrap,Posted by chengkang at 九月 18, 2024 14:52|
