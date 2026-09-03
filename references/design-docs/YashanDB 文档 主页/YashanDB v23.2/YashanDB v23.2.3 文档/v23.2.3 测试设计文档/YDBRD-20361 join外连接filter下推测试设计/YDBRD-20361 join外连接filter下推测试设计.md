Created by 袁芳达, last modified on 十月 15, 2024

  


# **1. 概述**

  


*IR链接：*    [https://pingcode.yasdb.com/pjm/items/6611056b579a3edb84d4b7cc](https://pingcode.yasdb.com/pjm/items/6611056b579a3edb84d4b7cc)    *? #YDBRD-12216 调整filter优化与outer转inner顺序*

*SR链接：*  ：    [https://pingcode.yasdb.com/pjm/items/66116497579a3edb84d6dc2b](https://pingcode.yasdb.com/pjm/items/66116497579a3edb84d6dc2b)    ?#YDBRD-20361 外连接谓词参与优化

开发设计文档：    [外连接的filter根据等价类下推+outer转inner后的谓词下推 - 特性设计 - 吴昊旻 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=152998900)      


# **2. 需求分析**

需求来源：  需求由外场 问题单引入    [[YDBRD-27946] LEFT OUTER JOIN支持ON条件谓词扩展 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-27946?filter=-4&jql=text%20~%20%22outer%22%20order%20by%20created%20DESC)    。

本需求的目标是保证joinOnFilter与whereFilter进行等价类扩展并尝试下推导到表上

# **3. 规格约束**

- outer join下推规则：
-     1. 补空边on谓词推到补空边上
    1. 非补空边where谓词推到非补空边上
    1. 连接谓词（on/where）放再on上

- inner join下推规则：
-     1. 补空边on谓词+where谓词
    1. 非补空边on谓词+where谓词
    1. 连接谓词（on/where）放再on上

- full join下推规则（*均为补空边）：
-     1. where谓词on谓词均不可下推



# **4. 测试**  **设计方法**   

1.主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

2.对比结果和master执行结果是否一致

  


  


|专项|是否涉及,  
|测试点|
|:---|:---|:---|
|CT|-|-|
|长稳|-|  
|
|一致性|-|  
|
|安全|-|  
|
|HA|-|  
|
|压力|-|  
|
|性能|下推之后的比之前的master好|根据外场场景验证|
|资料|-|  
|


# 5.   **详细测试设计**

  


|join 类型|filter 位置|fliter条件|是否能下推|eg|
|:---|:---|:---|:---|---|
|left/right outer join|on|=,<,>,<=,>=,!=,like,not like,rlike,not rlike,between ...and,is null, is not null,in, not in,     exists subquery,any,all,some,rownum,rowid,limit,offset|补空边的on filter（单表谓词）  可将谓词推到该  **补空边**  的表上,非补空边的on filter（单表谓词）只在outer转inner之后可将谓词推到该非  **补空边**  的表上,连接非补空边和补空边的on filter（    [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    )，不可将该谓词推到任意一边的表上|create table t1 (id int , c1 int );,create table t2 (id int , c1 int );,insert into t1 values (1,2);,insert into t1 values (2,3);,insert into t1 values (3,4);,insert into t2 values (1,2);,insert into t2 values (2,3);,select * from t1 left join t2 on t1.id= 1;    非补空边的on filter（单表谓词）,select * from t1 left join t2 on     [t1.id](http://t1.id)    = 1 and     [t2.id](http://t2.id)    =2  ;    补空边的on filter（单表谓词）,select * from t1 left join t2 on     [t1.id](http://t1.id)    =    [t2.id](http://t2.id)    ;   连接非补空边和补空边的on filter（    [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    )|
||where|=,<,>,<=,>=,!=,like,not like,rlike,not rlike,between ...and,is null, is not null,in, not in,     exists subquery,any,all,some,rownum,rowid,limit,offset|非补空边的where filter（单表谓词）  可将谓词推到该  **非补空边**  的表上,补空边的where filter（单表谓词）只在outer转inner之后可将谓词推到该  **补空边**  的表上,连接非补空边和补空边的where filter（    [t1.id](http://t1.id/)       =       [t2.id](http://t2.id/)    )，该谓词不可下推,  
|SELECT * FROM t1 LEFT JOIN t2 ON     [t1.id](http://t1.id)     = 3 where     [t1.id](http://t1.id)    =1;    非补空边的where filter（单表谓词）, SELECT * FROM t1 LEFT JOIN t2 ON     [t1.id](http://t1.id)     = 3 where     [t2.id](http://t2.id)     is null; 补空边的where filter（单表谓词）,SELECT * FROM t1 LEFT JOIN t2 ON     [t1.id](http://t1.id)     = 3 where     [t2.id](http://t2.id)     =    [t1.id](http://t1.id)    ;  连接非补空边和补空边的where filter,  
,  
,![](https://pingcode.yasdb.com/atlas/files/public/67396cf38970c2af4f520f59/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ4NzIsImV4cCI6MTc4MjMxNTY3Mn0.3sUJmL1r96cCu0CT1uePl4OMcyq8ppDiKSqMmlzwhXE)|
|full outer join |on|=,<,>,<=,>=,!=,like,not like,rlike,not rlike,between ...and,is null, is not null,in, not in,     exists subquery,any,all,some,rownum,rowid,limit,offset|full outer join两边均为补空边，所以on filter（单表谓词）均不可下推|select * from t1 left join t2 on     [t1.id](http://t1.id)    = 1; |
||where|=,<,>,<=,>=,!=,like,not like,rlike,not rlike,between ...and,is null, is not null,in, not in,     exists subquery,any,all,some,rownum,rowid,limit,offset|full outer join两边均为补空边，所以单表where谓词均不可下推，加出result 挂上|select * from t1 full join t2 on     [t1.id](http://t1.id)    =    [t2.id](http://t2.id)     where t1.id=1; |
|inner join|on|=,<,>,<=,>=,!=,like,not like,rlike,not rlike,between ...and,is null, is not null,in, not in,     exists subquery,any,all,some,rownum,rowid,limit,offset|1. 补空边filter/非补空边filter放到各自表上
1. 连接非补空边和补空边的filter放到on条件上
|  
|
||where|=,<,>,<=,>=,!=,like,not like,rlike,not rlike,between ...and,is null, is not null,in, not in,     exists subquery,any,all,some,rownum,rowid,limit,offset|1. 补空边filter/非补空边filter放到各自表上
1. 连接非补空边和补空边的filter放到on条件上
|  
|




# 5.   **测试用例**

   电子表格

# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、行存|


  


# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# **8. 工作量评估**

工作量：5人/天

计划测试完成时间：

  


测试设计评审纪要    
    
  与会人：    
    
  评审时间：    
    
  评审地点：腾讯会议    
  会议主题：    
    
  评审纪要信息：

1.多表join混合

2.造数时注意不同filter时结果有区别

  




  
  评审通过与否：

  


## Attachments:

[image2024-5-13_18-19-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjNhMWFkOWEzMzExZGM4ZGM4IiwicmVmX2lkIjoiNjczOTZjZjM3MjgyMDZlZmI5MmYxOGYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODcyLCJleHAiOjE3ODIzOTEyNzJ9.F9XOb6mfWn6Yy23FkgiSOnjPFOMUxsWQ3uoUYy_9Nlo)

 (image/png)    
