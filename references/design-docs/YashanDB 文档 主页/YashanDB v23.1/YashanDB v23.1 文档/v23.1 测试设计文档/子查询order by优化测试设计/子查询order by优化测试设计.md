Created by 李攀, last modified on 五月 12, 2023

SR：    [[YDBRD-13658] 子查询中order by的优化去除 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13658)  

设计文档：    [子查询order by优化设计方案 - 谭思宇 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109585658)  

  


# **1. 概述**

本文描述子查询order by 优化功能的测试设计

  


# **2. 需求分析**

1.  部分子查询场景下order by无意义，可以进行优化
1. 当前版本将按照较为严格的场景进行设计，除from子查询外的其他位置的子查询，即投影列子查询，in/exists子查询，filter子查询（包括like，any与having），在不含有limit或offset的时候，orderby都不含有实际意义，可被优化去除。
1. exists在不为关联子查询的时候只要limit大于0即可优化。
1. 限制表格


|  
|from|投影列|in/exists|filter|
|:---|:---|:---|:---|:---|
|优化条件|-|不含limit或offset时可优化|不含limit或offset时可优化|不含limit或offset时可优化|


![](https://pingcode.yasdb.com/atlas/files/public/673969d7a1ad9a3311dc7955/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA1OTcsImV4cCI6MTc4MjIyMTM5N30.7PJ5OGrKnQQD24Kk6-eUJbZEdkpmxK0M5PWqFLJD1aQ)

# **3. 测试**  **设计方法**   

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|from子查询|不含join 的查询|不优化|  
|  
|
|  
|join，单节点，多节点join,hash,nl,merge|  
|  
|  
|
|投影列子查询|ordey by 不含limit|  
|order by 含有limit +offset|  
|
|  
|  
|  
|错误的order by 列  |  
|
|  
|  
|  
|limit 大于0|  
|
|  
|  
|  
|LIMIT是负值|  
|
|  
|  
|  
|limit null|  
|
|  
|  
|  
|limit 行大于查询行数|  
|
|  
|  
|  
|limt +offset 语法报错|预期报错|
|in/exists子查询|ordey by 不含limit|  
|order by 含有limit +offset|不优化，不会去掉order by    
    
    
    
|
|  
|not in |  
|  
||
|  
|not exists|  
|LIMIT是负值||
|  
|exists 非关联子查询含limit 大于等于0|优化|limit null||
|  
|exists改写 加LIMIT后排序还在不在，|重点关注一下|  
|  
|
|  
|  
|  
|  
|  
|
|filter子查询|like,not like ,rlike,not rlike|  
|like里面含有limit和offset的子查询语句  limit 1、limit 1 offset 2、 limit|  
|
|  
|any,some， all（select 单列）|  
|any,some all （返回单列但是为含有limit的子查询），select c1>any(select c from t2 limit 10) from t1;|  
|
|  
|having（返回单行单列，不含有limit的语句）|  
|having后子查询为为含有order by limit 的语句|  
|
|  
|> = < <> >= （select 结果单行单列+orderby）|  
|> = < <> >= （select 结果非单行单列+orderby),加 limit|预期报错|
|  
|  
|  
|  
|  
|
|场景|标量子查询|  
|  
|  
|
|  
|关联子查询|  
|  
|  
|
|  
|connect by|  
|  
|  
|
|  
|filter 子查询在投影列，布尔表达式|  
|  
|  
|
|  
|group by|  
|  
|  
|
|  
|子查询嵌套,128层嵌套,  
|  
|  
|  
|
|  
|聚合函数|  
|  
|  
|
|  
|cte|  
|  
|  
|
|  
|insert into select|  
|  
|  
|
|  
|select for update|  
|  
|  
|
|  
|索引|  
|  
|  
|
|  
|与order by下推场景结合|  
|  
|  
|
|  
|绑定参数|  
|  
|  
|
|  
|投影列布尔表达式|  
|  
|  
|
|  
|order by 多列|  
|  
|  
|
|  
|order by不是投影出来的列|  
|  
|  
|
|  
|join|  
|  
|  
|
|表类型|heap|  
|  
|  
|
|  
|tac|  
|  
|  
|
|  
|lsc|  
|  
|  
|
|分区表|range、list、interval|  
|  
|  
|
|临时表|  
|  
|  
|  
|
|视图|查询视图语句里面含有带order by的子查询|  
|  
|  
|
|  
|  
|  
|  
|  
|
|过程体|  
|  
|  
|  
|
|order by 列 数据类型覆盖|  
|  
|  
|  
|
|explain |  
|查看计划中是否有order by,语句是否改写|  
|  
|
|  
|  
|  
|  
|  
|
|并发场景|testkill框架CT并发|  
|  
|  
|


  


结果和oracle ,mysql对比参考

# 4.   **详细测试设计**

  


# 5.   **测试用例**

  


# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments: