Created by 罗爽, last modified by  施新华 on 十二月 12, 2023

# 1.   **概述**

本文描述列存计算窗口函数支持hash分区的测试设计。

SR：    [YDBRD-21505](https://jira.yasdb.com/browse/YDBRD-21505?src=confmacro)    -  列存计算窗口函数支持Hash分区  完成

开发设计文档：    [列存窗口函数支持Hash分区详细设计文档](133577533.html)  

# 2.   **需求分析**

当前窗口函数的实现基于排序实现，Partition By其实是用Order By实现的，这样会导致排序的计算量很大。为提升计算速度，将Partition by改为hash分区实现。

测试包括功能测试和性能测试。语法只考虑带partition_clause的情况，即partition_clause、partition_clause + order_by_clause、partition_clause + order_by_clause + windowning_clause。

![](https://pingcode.yasdb.com/atlas/files/public/67396b9ea1ad9a3311dc8446/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBSUFBQUFBQUVBQUFBQUFJQUFBQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU4NDgsImV4cCI6MTc4MjMwNjY0OH0.2YfNSGZDaILFUhplBP7YJcegWEkJGWuxe5dRuCGuNTg)

1）功能测试复用原有用例：

单机功能用例：    [https://git.yasdb.com/luoshuang/yasft/-/tree/master/standalone/testcase/function3/OLAP_func](https://git.yasdb.com/luoshuang/yasft/-/tree/master/standalone/testcase/function3/OLAP_func)  

分布式功能用例：    [https://git.yasdb.com/luoshuang/yasft/-/tree/master/distribution/testcase/function3/OLAP_func](https://git.yasdb.com/luoshuang/yasft/-/tree/master/distribution/testcase/function3/OLAP_func)  

功能用例补充测试点：

- explain
- autotrace
- 并行度查询（不支持并行查询，SQL执行成功，执行计划中体现）
- 统计信息 - 收集统计信息后再执行select查询，理论上速度会快一些


           - 对比直接查询与analyze后查询的执行时间

           - 对比本特性与master版本的analyze-select的执行时间

- partition by多列有重复列时，执行计划需要优化
- 确认partition by列是否覆盖所有数据类型   - 是
- 确认partition列与分区列的关系是否覆盖    - 否，需要补充用例


           - partition列是否为分区列（是、否）

           - partition列与分区列是否相同（完全相同，完全不同、部分相同）

2）性能测试

测试点：对比支持hash分区前后的业务执行时间。

数据模型：tpcds 10G数据。

表类型覆盖：单机普通表，分区表；分布式普通表，分区表，分布表，复制表；lsc/tac。（注：分布式普通表等价于一级分区表，分区键为第一列）。

# 3.   **测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计。

# 4.   **详细测试设计**

|输入条件|有效等价类|备注|
|---|---|---|
|SQL语法    
    
|partition_by|例：sum(c1) over(partition by c1)|
||partition_by + order by|例：sum(c1) over(partition by c1 order by c2)|
||partition_by + order by + windowning|例：sum(c1) over(partition by c1 order by c2 rows between unbounded preceding and current row)|
|partition列|单列|  
|
||多列|  
|
|partition列数据类型|整型|取代表类型即可    
    
|
||浮点||
||字符串||
||时间类型||
|partition列与order by列关系|完全相同|  
|
||部分相同|  
|
||完全不同|  
|
|索引    
    
|partition列有索引|关注执行计划是否走了窗口函数hash|
||order by列有索引||
||partition列和order by列都有索引    
  （组合索引，单列索引）||
|partition by嵌套函数|嵌套其他窗口函数|选取部分函数即可|


测试场景：

正常场景：tpcds 10G数据。

极端场景：

1）数据分区极不平衡。

2）分区数特别多。

  


[YDBRD-21505 列存窗口函数支持hash分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWQ4OTcwYzJhZjRmNTIwNWNjIiwicmVmX2lkIjoiNjczOTZiOWQ1OTNmOTljOWZmMjM2NGQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODQ4LCJleHAiOjE3ODIzODIyNDh9.3UTVV6QpyjHPbnQnmMLfHNJpoKvj1SIMqPCG0Ngmlls)

# 5.  ** 测试用例设计**

[YDBRD-21505的文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWQ4OTcwYzJhZjRmNTIwNWNkIiwicmVmX2lkIjoiNjczOTZiOWQ1OTNmOTljOWZmMjM2NGQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODQ4LCJleHAiOjE3ODIzODIyNDh9.IXlmGCT5D0eTvgs1kTy6ljukn3PcOzKQPkfoYPod-ec)

# 6.   **测试框架设计**

**yasft框架**

# 7.   **测试环境说明**

**无特殊需求**

  


  


## Attachments:

[YDCRD-11538 列存窗口函数支持hash分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWVhMWFkOWEzMzExZGM4NDQ0IiwicmVmX2lkIjoiNjczOTZiOWQ1OTNmOTljOWZmMjM2NGQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODQ4LCJleHAiOjE3ODIzODIyNDh9.0q-u0z-utfiJpUoLYB3IMIXHYPkIcxhytZy3ZHg3MgQ)

 (application/x-xmind)    


[YDCRD-11538 列存窗口函数支持hash分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWVhMWFkOWEzMzExZGM4NDQ1IiwicmVmX2lkIjoiNjczOTZiOWQ1OTNmOTljOWZmMjM2NGQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODQ4LCJleHAiOjE3ODIzODIyNDh9.rDntNGjIMwo7SXjBYY0if2IYFwhA4k10MYIpNtcZBDs)

 (application/x-xmind)    


[YDBRD-21505 列存窗口函数支持hash分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWQ4OTcwYzJhZjRmNTIwNWNjIiwicmVmX2lkIjoiNjczOTZiOWQ1OTNmOTljOWZmMjM2NGQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODQ4LCJleHAiOjE3ODIzODIyNDh9.3UTVV6QpyjHPbnQnmMLfHNJpoKvj1SIMqPCG0Ngmlls)

 (application/x-xmind)    


[YDBRD-21505的文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWQ4OTcwYzJhZjRmNTIwNWNkIiwicmVmX2lkIjoiNjczOTZiOWQ1OTNmOTljOWZmMjM2NGQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODQ4LCJleHAiOjE3ODIzODIyNDh9.IXlmGCT5D0eTvgs1kTy6ljukn3PcOzKQPkfoYPod-ec)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
