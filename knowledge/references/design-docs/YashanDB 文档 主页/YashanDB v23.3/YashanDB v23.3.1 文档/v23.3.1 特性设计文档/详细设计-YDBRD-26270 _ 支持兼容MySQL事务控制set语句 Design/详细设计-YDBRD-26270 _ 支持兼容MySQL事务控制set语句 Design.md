Created by 钟金健 on 八月 14, 2024

*IR链接：*

  [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f2](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f2)    *?*    
  *#YASHAN-930 【mysql兼容】（功能&语法）支持特定的运维&管理语法 （做语法兼容，暂不支持功能）*

*SR链接：*

  [https://pingcode.yasdb.com/pjm/items/66191483fd997db58ad89207](https://pingcode.yasdb.com/pjm/items/66191483fd997db58ad89207)    *?*    
  *#YDBRD-26270 支持MySQL事务控制相关Set语句*

  [https://pingcode.yasdb.com/pjm/items/664c0e0f288e1978208f5a19](https://pingcode.yasdb.com/pjm/items/664c0e0f288e1978208f5a19)    *?*    
  *#YDBRD-27720 【研发】支持MySQL事务控制相关Set语句*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#1-%E6%80%BB%E8%BF%B0)  

该SR主要是做三个功能：

1. 系统变量和会话变量autocommit生效（承接需求    [【YDBRD-26286 支持MySQL变量类型】](https://pingcode.yasdb.com/pjm/items/661916eefd997db58ad89729)    ）
1. ~~语法兼容~~  ~~SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ~~
1. 支持START TRANSACTION语句显式起事务


###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

原始的客户需求描述。关注需求的来源、规格、合理性，要用明确的语言描述，不能模棱两可。要把客户的业务场景描述清楚，知道客户希望怎么用，而且除了功能特性要求，也要尽可能了解非功能特性要求，例如性能、安全等。

**需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分行存和列存。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [调研-YDBRD-26270 : 支持兼容MySQL事务控制set语句 Research](https://conf.yasdb.com/pages/viewpage.action?pageId=162994160)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

1.autocommit相关，要支持对变量类型的设置。

~~2.SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ，只做语法兼容。~~

3.该SR需支持START TRANSACTION

  


|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|autocommit变量生效|  
|是|是|
|~~功能~~|~~SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ语法兼容~~|  
|~~是~~|~~是~~|
|功能|START TRANSACTION开启事务|  
|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|事务|描述|是|业界资料链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|~~SQL语法~~|~~SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ~~|~~语法兼容~~|~~是/否~~|
|SQL语法|START TRANSACTION|开启事务|  
|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

事务：

mysql支持的事务隔离级别配置：  读未提交、读已提交、可重复读  （默认）  、可串行化

yasdb支持的事务隔离级别配置：  读已提交  （默认）  、可串行化

本次SR不改动事务隔离级别的配置。

（建议mysql的事务隔离级别：可重复读对应yasdb的可串行化，数据库默认的隔离级别保持read commited）

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性设计1](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

autocommit：

|系统变量名称|autocommit|  
|
|---|---|---|
|作用|系统变量，控制语句执行是否需要对事务进行自动commit操作|  
|
|作用域|global级，session级（全局级、会话级）|  
|
|是否可以在sql语句中使用hint语法独立设置|否|  
|
|类型|tyint|  
|
|取值范围|0（off/false）,1（on/true）|session级别的autocommit的值从0变成1的时候，会把当前未提交的事务进行提交|
|默认值|1|global级变量默认值为1。,session级变量初始化值为global当前值|


  


|  
|全局系统级|会话系统级|用户变量|
|---|---|---|---|
|set语句|1. set global autocommit = 右值
1. set @@global.autocommit = 右值
|1. set session autocommit = 右值
1. set @@session.autocommit = 右值
1. set @@autocommit = 右值
1. set     autocommit    = 右值
1. set local autocommit = 右值
1. set @@local.autocommit = 右值
|  
|
|select语句|1. select   @@global.autocommit
|1. select @@session.autocommit 
1. select @@autocommit 
|  
|


  


  


#### autocommit变量生效优先级

（一）mysql客户端连yasdb场景下：

autocommit行为根据session级确定

  


（二）yasql连接的yasdb情况下：

yasql客户端也可以控制autocommit

优先级顺序方案待定：

1. session级>yasql客户端（yasql客户端的autocommit设置在mysql兼容模式下不会生效了）（最终选用方案）
1. yasql客户端>session级


  


###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

~~SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ~~

~~语法兼容，实际不生效~~

~~实现：增加语法路径，但是不改变数据库状态~~

（待确定：是否与其他需求冲突）——已在其他需求里支持了

###   [4.3 特性性能点](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)      [3](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

支持START TRANSACTION

语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396edf8970c2af4f521c07/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1OTgsImV4cCI6MTc4MjQ1NTM5OH0.E-XPpQCA4oRkGeMFMSEPhc4rjWHrwjYiu2XVs9WbrNI)

start transaction开启一个事务，在后续显式使用commit，rollback后，事务结束。如果没有显式调用commit、rollback就结束了连接，则按照事务没有提交进行处理。

调研结果：mysql在start transaction开启以后，并不会更改session.autocommit的值，

  


客户端结束的时候，发出登出的时候，yashan模式下，会将未提交的事务进行提交。而mysql兼容模式下，在进行登出的时候不会对未提交的事务进行提交。

切换模式的时候，未提交的事务行为如何处理：按照新模式的提交方式进行处理

  


  


事务的开始与结束

待确认点：

1. 当前yasdb没有主动开启事务的功能，start transaction是否需要主动开启事务   ——需要增加主动开启事务的功能


待确定：当前会话使用start transaction开启事务以后，需要一个session级别的标记位对当前语境进行标识。执行语句的stmt上的autocommit标识要根据session级别的语境进行赋值

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. 语法正常与异常分支
1. 正常使用场景（事务可见性结果正确）
1. 事务未提交异常结束，事务结果回滚和提交的行为是否符合预期
1. ...


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments: