Created by 刘清萍, last modified on 十月 15, 2024

## 1.概述

  本文主要内容为索引支持的filter类型与条件扩展的测试设计。

## 2.需求分析

-  is null, is not null可以使用索引等。
-    like param  可以生成索引扫描计划，如果执行无法走rangescan，则执行走full scan。
-  支持单机和分布式


开发参考文档：

  [[YDBRD-13993] 索引支持的filter类型与条件扩展 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13993)  

  [索引能力扩展方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109579084&moved=true)  

  [YDBRD-13993](https://jira.yasdb.com/browse/YDBRD-13993?src=confmacro)    -  索引支持的filter类型与条件扩展  完成

  


example:

![](https://pingcode.yasdb.com/atlas/files/public/67396993a1ad9a3311dc77a0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFJQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0NBQUFBQUFFQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDczMDcsImV4cCI6MTc4MjIxODEwN30.Zv97tu3-aCg4PgkGSSDssqAcqWPQuoFdofE8J-BDVko)

![](https://pingcode.yasdb.com/atlas/files/public/67396993a1ad9a3311dc77a1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFJQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0NBQUFBQUFFQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDczMDcsImV4cCI6MTc4MjIxODEwN30.Zv97tu3-aCg4PgkGSSDssqAcqWPQuoFdofE8J-BDVko)

## 3.测试设计方法

        主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|Like|常量 、 ？绑定参数|第一个字符不能为%  _|列名|  
|
|  
|  
|  
|子查询|  
|
|  
|  
|  
|常量不合法值|  
|
|  
|  
|  
|表达式（abs(c1),abs(param) 、c1+1)|  
|
|  
|  
|  
|数据类型不一致|  
|
|null|is not null、is null|  
|= null、！=null---恒fasle|  
|
|  
|(>1 or <2)等价为is not null---keke|  
|  
|  
|
|表类型|heap tac|  
|lsc|  
|
|索引类型|函数索引 |  
|列式索引|  
|
|  
|reverse索引–支持null  |  
|不支持like|  
|
|  
|分区表的local索引|  
|  
|  
|
|  
|唯一、主键|  
|  
|  
|
|索引多次删除并建立|  
|  
|  
|  
|
|order by |  
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
|  
|  
|
|connect by |strat with|  
|  
|  
|
|filter位置|where后|多层嵌套条件 （(c1 is null) and c2 like ~）|group by 后报错|  
|
|  
|having后|  
|  
|  
|
|  
|放在connect by后|  
|  
|  
|
|  
|join on后|  
|  
|  
|
|filter组合（对索引列）|and、or 多个filter|  
|  
|  
|
|  
|in、exists|  
|  
|  
|
|  
|比较cmp|  
|  
|  
|
|  
|between and |  
|  
|  
|
|  
|cash when|  
|  
|  
|
|子查询|sub join sub  |  
|  
|  
|
|  
|from sub|  
|  
|  
|
|  
|select sub|  
|  
|  
|
|create table as / view|  
|  
|  
|  
|
|增删查|insert|  
|  
|  
|
|  
|update|  
|  
|  
|
|  
|delete|  
|  
|  
|
|  
|merge|  
|  
|  
|


**tips：**

1. like 计划显示又有access 又有filter 
1. null转化为access


## 5.测试用例设计

## 6.测试框架设计

 本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

## 7.测试环境说明

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|  
|


  


  


  


## Attachments:

[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTJhMWFkOWEzMzExZGM3NzlkIiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.zwxOy9ceCGxWRh9k0HwaamVSSBwIfULY9XYdn1Zux-w)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTI4OTcwYzJhZjRmNTFmOTI2IiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.aGSeahNxz9tX5zifvknra_xFsRRJyzCZyoDyYfZFskI)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTJhMWFkOWEzMzExZGM3NzllIiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.VwTj0FbjoiLslFfeU9_NWq93OUI5l2tgmxCfl5tlWoE)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTM4OTcwYzJhZjRmNTFmOTI3IiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.TuHwqA9QXskmUVhCruNlR5dh0EWiHPPrjvYllUV_EjU)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTM4OTcwYzJhZjRmNTFmOTI4IiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.EVhD32Okaa5RzoQ0Vy65elwE-xYEFpGPPDDixI5MEpw)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTM4OTcwYzJhZjRmNTFmOTI5IiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.D8zQf0WRYoghc8fkVAE8Y-RCV3tcXuNalCBXhXwCs7U)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTM4OTcwYzJhZjRmNTFmOTJhIiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.m72lU0yYT2qe8scS3Z9J20dTJGv9GVNgss-_BzEUJ-k)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTM4OTcwYzJhZjRmNTFmOTJiIiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.L8BiFUeqiCC7NIKUuwsUWxCzpc3Rk2OlO7YD9qMoKHg)

 (image/svg+xml)    


[index_enhance文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTNhMWFkOWEzMzExZGM3NzlmIiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.9hLIDbcaIl6Pm7NK_1ng0XXq1kHo99kUPSUefEKund4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[index_enhance文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTM4OTcwYzJhZjRmNTFmOTJjIiwicmVmX2lkIjoiNjczOTY5OTI3MjgyMDZlZmI5MmVmNDk2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzA3LCJleHAiOjE3ODIyOTM3MDd9.xqNgGKi6Qh1bTm_vq8B25e4jPr3g12BgvfWwPEdfk14)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
