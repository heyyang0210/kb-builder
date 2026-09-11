Created by 刘清萍, last modified on 十月 15, 2024

## 1.概述

  本文主要内容为行存执行移除RBO依赖的测试设计。

## 2.需求分析

### 2.1需求来源

           行存执行中还有基于RBO的设计残留，导致对CBO的支持不完善，需要完全适配CBO并行计划和分布式计划

### 2.2 sequence语法

  


![](https://pingcode.yasdb.com/atlas/files/public/6739696fa1ad9a3311dc7693/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBSUFBQUNFQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjc0OTYsImV4cCI6MTc4MjEzODI5Nn0.6c_Lgkjgyw_jI0j7OpJfoZiN5O1uAVziD6AbOO_ILLI)

CurrVal：返回 sequence的当前值 ------未支持

select seqtest.currval from dual

![](https://pingcode.yasdb.com/atlas/files/public/6739696f8970c2af4f51f81e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBSUFBQUNFQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjc0OTYsImV4cCI6MTc4MjEzODI5Nn0.6c_Lgkjgyw_jI0j7OpJfoZiN5O1uAVziD6AbOO_ILLI)

NextVal：增加sequence的值，然后返回增加后sequence值

得到值语句如下：

SELECT Sequence名称.CurrVal FROM DUAL;

开发参考文档： 

  [[YDBRD-11758] 行存执行移除RBO依赖 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-11758)      [需求调研和设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=107383848)  

  [YDBRD-11758](https://jira.yasdb.com/browse/YDBRD-11758)  

  


  [YDBRD-11758](https://jira.yasdb.com/browse/YDBRD-11758?src=confmacro)    -  行存执行移除RBO依赖  完成

## 3.测试设计方法

        主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件1|场景|输入条件2|场景|  
|
|:---|:---|:---|:---|:---|
|rownum|select|order by|null |  
|
|  
|group by|  
|rownum|  
|
|  
|having|  
|col、sin(col)、多列、投影列、非投影列、  aggr (distinct c1)|  
|
|  
|where|  
|subquery------预期报错、标量子查询、关联子查询------预期有结果|  
|
|  
|  
|  
|aggr (col)-------报错|  
|
|  
|  
|  
|distinct|  
|
|  
|  
|  
|  
|  
|
|sequence|insert |insert all 多表------------报错|sequence.nextval|  
|
|  
|  
|insert 约束—check 、unique、主键、外键、|函数嵌套nextval|  
|
|  
|  
|insert duplicate|子查询|  
|
|  
|  
|insert values多值-----------报错|nextval加减乘除col or const|  
|
|  
|  
|insert select|一个语句中，使用多个nextval|  
|
|  
|  
|insert select on duplicate|  
|  
|
|  
|update|多表update|  
|  
|
|  
|select|   不包含子查询、snapshot、VIEW的 SELECT 语句|  
|  
|


  


## 4.测试用例设计

  


## 5.测试框架设计

  


 本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

## 6.测试环境说明

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|  
|


## Attachments:

[error.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmY4OTcwYzJhZjRmNTFmODFhIiwicmVmX2lkIjoiNjczOTY5NmY1OTNmOTljOWZmMjM0ZWNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDk2LCJleHAiOjE3ODIyMTM4OTZ9.u_KWybQX9XciFmoyFQjgUveJxdfQaV-LTn1OxrshzWc)

 (image/svg+xml)    


[error.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmY4OTcwYzJhZjRmNTFmODFiIiwicmVmX2lkIjoiNjczOTY5NmY1OTNmOTljOWZmMjM0ZWNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDk2LCJleHAiOjE3ODIyMTM4OTZ9.bLc-Ksk-M4WX1bi4v66CwhI202f1SUaKeiqDG3Vl2N0)

 (image/svg+xml)    


[error.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmY4OTcwYzJhZjRmNTFmODFjIiwicmVmX2lkIjoiNjczOTY5NmY1OTNmOTljOWZmMjM0ZWNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDk2LCJleHAiOjE3ODIyMTM4OTZ9.1DdhzVHD-KPjbUumpwiy3wc317QiuR_x_vKymkBcvHQ)

 (image/svg+xml)    
