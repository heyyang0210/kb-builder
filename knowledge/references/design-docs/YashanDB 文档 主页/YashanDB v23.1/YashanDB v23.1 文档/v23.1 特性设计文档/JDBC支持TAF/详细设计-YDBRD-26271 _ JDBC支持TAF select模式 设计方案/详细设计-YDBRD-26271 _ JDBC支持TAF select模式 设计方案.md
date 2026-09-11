Created by 张周玺, last modified by  侯忠林 on 七月 02, 2024

*详细设计-YDBRD-XXXX : XXX Design（XXX方案设计）*

*IR链接：*    [https://pingcode.yasdb.com/pjm/items/6618e5e6fd997db58ad82892](https://pingcode.yasdb.com/pjm/items/6618e5e6fd997db58ad82892)    *?*    
  *#YDBRD-26271 【JDBC】TAF支持select接续*

*SR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2a6](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2a6)    *?*    
  *#YASHAN-854 集群完善TAF能力：支持SELECT接续*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

TAF全称Transparent Application Failover，驱动的透明应用故障转移功能，使你能够在连接的数据库实例发生故障时自动重新连接到数据库。新的数据库连接，虽然是由不同的节点创建的，但与原来的连接是相同的。在重新连接过程中，之前的活动事务将会被回滚，但在“具体条件”下TAF可以保证SELECT语句不被终止。这也是RAC亮点之一。所谓的“具体条件”指的就是FAILOVER_MODE中METHOD选择“BASIC”、TYPE选择“SELECT”。

透明应用故障转移（TAF）是Java数据库连接（JDBC）驱动程序的一个功能（Oracle是JDBC调用OCI接口实现）。如果连接的数据库实例失败，它使应用程序能够自动重新连接到数据库。在这种情况下，活动的事务会回滚。

当一个建立连接的实例失败或关闭时，客户端的连接会变得陈旧，并会向试图使用它的调用者抛出异常。TAF使应用程序能够透明地重新连接到一个预先配置的二级实例，创建一个新的连接，但与第一个原始实例上建立的连接相同。也就是说，连接的属性与早期连接的属性相同。无论连接是如何丢失的，这都是真的。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

  [JDBC支持TAF - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109587270)  

**之前taf需求没做select模式，本次把select模式补齐，规格等都与原来taf需求保持一致。**

**select模式具体行为就是FAILOVER_MODE设置为select之后，在执行查询语句过程中（包括执行和fetch两个过程）如果出现IO异常，执行故障转移并且不报错让业务继续执行。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [JDBC支持TAF select 模式调研。](147775337.html)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|select 模式下select 语句执行的续接|先走普通taf，如果taf执行成功，判断如果是select语句，把select语句重新执行|是|是|
|性能|select 模式下fetch的续接|先走普通taf，如果taf执行成功，异常发生时记录当前fetch的行数，然后重试.|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|配置参数|jdbc配置参数failoverType，之前不支持不支持SELECT，现在支持了|----|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

  


只支持对  **不处于事务内**  的  **查询语句**  进行续接。

并且如果查询语句是不稳定的，那么可能会出现数据不一致的情况。

**不支持**  对查询结果的二次交互进行续接，二次交互包括   fetchCursor，readlob等操作。

参数里面的临时lob也是不支持的

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

  


###   [4.1 select 模式下select 语句执行的续接](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

io异常发生时，先走普通taf，如果taf执行成功，判断如果是select语句，把select语句重新执行

  


###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)      [select 模式下fetch执行的续接](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

执行fetch时记录当前fetch次数，io异常发生时，先走普通taf，如果taf执行成功，重新执行select语句，然后fetch到对应行数。

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

  


1. 直接执行：短sql和超长sql，带参数的直接执行.
1. prepare但是无参数的执行：短sql和超长sql.
1. prepare带参数执行，小数据量参数和超大数据量参数。
1. 不用关注批量执行，因为批量执行必然不包含select语句。
1. fetch测试需要关注带clob的场景。
1. 考虑可更新结果集和对数据敏感结果集的场景。
1. 流式fetch的场景。


  


自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,文档里说明对于不稳定的查询语句，taf出来结果可能有问题,Posted by zhangzhouxi at 六月 19, 2024 11:21|
|---|
|  [](null)  ,确认Oracle的回调和重新执行的执行顺序,Posted by zhangzhouxi at 六月 19, 2024 11:27|
|  [](null)  ,流式fetch和taf交叉,Posted by zhangzhouxi at 六月 19, 2024 11:28|
|  [](null)  ,参数里面临时lob,Posted by zhangzhouxi at 六月 19, 2024 11:29|
|  [](null)  ,查出来的clob在taf之后再操作的话啥行为,Posted by zhangzhouxi at 六月 19, 2024 11:35|
|  [](null)  ,先回调，再重新执行，顺序没啥问题,Posted by zhangzhouxi at 六月 19, 2024 16:38|
|  [](null)  ,Oracle不支持,Posted by zhangzhouxi at 六月 19, 2024 16:38|
|  [](null)  ,不支持,Posted by zhangzhouxi at 六月 19, 2024 16:38|
|  [](null)  ,流式fetch已支持，但是由于流式fetch的特殊机制，流式fetch要触发比较慢（取决于超时时间设置），慢的原因是流式fetch在后续fetch时不发消息，只收，这种情况没办法立刻感知到服务端已经挂了或者网络已经断了，必须是超时才能触发到IO异常,Posted by zhangzhouxi at 六月 19, 2024 19:03|
