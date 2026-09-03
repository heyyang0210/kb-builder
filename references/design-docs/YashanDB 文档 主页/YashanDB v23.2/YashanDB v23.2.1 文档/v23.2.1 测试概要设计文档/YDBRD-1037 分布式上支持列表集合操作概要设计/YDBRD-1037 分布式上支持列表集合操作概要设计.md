Created by 刘晓旋, last modified on 十二月 12, 2023

IR链接：    [YDBRD-10226](https://jira.yasdb.com/browse/YDBRD-10226?src=confmacro)    -  分布式支持特定集合操作  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

- 原单机列存已支持支持集合操作：  union, union all, intersect, intersect all, minus, minus all。
- 现分布式场景下列存也要支持对应集合操作。


##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b74a1ad9a3311dc8325/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQ0MTksImV4cCI6MTc4MjMwNTIxOX0.cVQOHqJaaVncL07zsn1hJxYMjjhm7vlmh2CpTq7NbYw)

分布式上验证集合操作：  union, union all, intersect, intersect all, except, except all, minus, minus all

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1. 集合操作都拉到cn上进行


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

集合查询

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

1. 集合规格测试
1. 各集合操作考虑投影的数据类型（相同类型、隐式转换）
1. 不同集合的优先级，同一语句覆盖不同类型的集合
1.   `intersect (all) > union (all) = minus (all)`  
1. 分布式涉及多节点，需要考虑部分节点有数据部分节点无数据、所有节点均有数据的情况
1. 分布式需要考虑单cn/多cn、单dn/多dn的情况
1. 对常用的系统视图执行集合操作
1. 集合下推场景
1. 集合+PLSQL
1. 集合+并行
1. 集合+join+子查询复杂查询
1. 复制表并行、分布式并行的情况
1. 访问计划合理
1. 集群是否支持，不支持需要考虑补充拦截用例
1. 行列混合集合拦截用例
1. 资源不足的场景，多层集合操作是否合理报错
1. 与Oracle不一致的地方，doc文档上是否有体现


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

ct/kt：ddl/dql 之间并发、dml/dql 之间并发、dql/dql 之间并发

长稳：数据量较大的情况

性能：与单机作对比

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

自动化看护

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

无

  


## Attachments:

[image2023-10-25_18-56-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzRhMWFkOWEzMzExZGM4MzIzIiwicmVmX2lkIjoiNjczOTZiNzQ1OTNmOTljOWZmMjM2MmMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NDE5LCJleHAiOjE3ODIzODA4MTl9.e2WMvHnDxDHsgOWYImwYLNTMZbak5G4nl2GEmgVN97E)

 (image/png)    


[image2023-10-25_18-56-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzQ4OTcwYzJhZjRmNTIwNGFkIiwicmVmX2lkIjoiNjczOTZiNzQ1OTNmOTljOWZmMjM2MmMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NDE5LCJleHAiOjE3ODIzODA4MTl9.f5xS8LN5ekULD5gdD59vPCltAS-hI1D6Agjzgi70rTA)

 (image/png)    


[image2023-10-25_18-57-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzRhMWFkOWEzMzExZGM4MzI0IiwicmVmX2lkIjoiNjczOTZiNzQ1OTNmOTljOWZmMjM2MmMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NDE5LCJleHAiOjE3ODIzODA4MTl9.jSK5gRL6LFProoK0BmyAG-_ec7cQ7oOReOF0TXSA5gw)

 (image/png)    
