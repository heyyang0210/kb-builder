Created by 程康, last modified on 十月 15, 2024

详细设计-YDBRD-26272 : 【c驱动】=TAF支持select接续方案设计

IR链接：    [https://pingcode.yasdb.com/pjm/items/6618e625fd997db58ad828d4](https://pingcode.yasdb.com/pjm/items/6618e625fd997db58ad828d4)    ?    
  #YDBRD-26272 【c驱动】TAF支持select接续

*SR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2a6](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2a6)    *?*    
  #YASHAN-854 集群完善TAF能力：支持SELECT接续

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

透明应用程序故障转移 （TAF） 是一项客户端功能，旨在最大程度地减少数据库连接因实例或网络故障而失败时对最终用户应用程序的中断。

TAF 可以在各种系统配置上实施，包括 Oracle Real Application Clusters （Oracle RAC） 和 Oracle Data Guard 物理备用数据库。TAF 也可以在重新启动单个实例系统后使用（例如，在进行修复时）。

可以将 TAF 配置为还原数据库会话，也可以选择重播打开的查询。从 Oracle 数据库 10g 第 2 版 （10.2） 开始，应用程序在尝试故障转移失败后尝试使用的所有语句。也就是说，尝试执行或获取其他语句会进行 TAF 恢复，就像失败时语句一样。后续语句现在可能会成功（而过去它们会失败），或者应用程序可能会收到与尝试的 TAF 恢复相对应的错误（例如       `ORA-25401`    ）。

注：远程数据库链接或 DML 语句不支持 TAF。

同时支持服务端+客户端配置

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

**之前taf需求没做select模式，本次把select模式补齐，规格等都与原来taf需求保持一致。**

**select模式具体行为就是FAILOVER_MODE设置为select之后，在执行查询语句过程中（包括执行和fetch两个过程）如果出现IO异常，执行故障转移并且不报错让业务继续执行。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [JDBC支持TAF select 模式调研。](/pages/createpage.action?spaceKey=~chengkang&title=JDBC%E6%94%AF%E6%8C%81TAF+select+%E6%A8%A1%E5%BC%8F%E8%B0%83%E7%A0%94%E3%80%82)  

  [Transparent Application Failover - 侯忠林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~houzhonglin/Transparent+Application+Failover)  

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

**FAILOVER**  **：**

子参数

|参数名|值|说明|
|:---|:---|:---|
|TYPE|  `select`    ：允许打开游标的用户在失败后继续获取它们。但是，这种模式在正常的选择操作中涉及到客户端的开销。|指定故障转移的类型。支持在    `select语句中发生taf后依然能正常的返回select的结果`  |


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1. 只支持对  **不处于事务内**  的  **查询语句**  进行续接。
1. 并且如果查询语句是不稳定的，那么可能会出现数据不一致的情况。
1. **不支持**  对查询结果的二次交互进行续接，二次交互包括   fetchCursor，readlob等操作。
1. 参数里面的临时lob也是不支持的
1. fetch结果集里面的lob在发生TAF之后不再支持进行二次交互了。（服务端不认）


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

### 4.1 select 模式下select 语句执行的续接

io异常发生时，先走普通taf，如果taf执行成功，判断如果是select语句，把select语句重新执行

触发TAF中select模式的接口有yacDirectExecute，yacExecute（和JDBC一致不包括yacPrepare）并且sql类型未执行select。

实现：

1. 在yacDirectExecute，yacExecute执行异常触发TAF报错以后，检测TAF是否已经连接成功
1. 判断TAF的模式是否是select，是否没有在事务中
1. 先执行yacPrepare，再重新执行yacDirectExecute，yacExecute，返回结果。


### 4.2 select 模式下fetch执行的续接

执行fetch时记录当前fetch次数，io异常发生时，先走普通taf，如果taf执行成功，重新执行select语句，然后fetch到对应行数。

触发TAF中select模式的接口有yacFetch，只有fetch需要请求服务端数据的时候才会触发（接口yacRequestFetch）。

实现：

1. 在yacRequestFetch向服务端请求数据，执行异常触发TAF报错以后，检测TAF是否已经连接成功
1. 判断TAF的模式是否是select，是否没有在事务中
1. 先执行yacPrepare，yacExecute，再根据执行了多少次的yacRequestFetch，再跳过固定的包，再重新执行yacRequestFetch，返回结果，yacFetch继续执行。


### 4.3 TAF模式下Lob禁用问题

在TAF发生以后，因为lob是和conn绑定的，目前服务端的lob再给服务端交互的时候有sid的校验，会报INVALID_LOBLOCATOR，能够拦截。（sid可能会重复，并且数据库重启可能存在一致的情况）

在Lob上记录conn的csn，每次请求就比对csn的和当前conn的csn对比，如果csn对比不一致说明conn已经变化则报错。

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

  


1. 直接执行：短sql和超长sql，带参数的直接执行.
1. prepare但是无参数的执行：短sql和超长sql.
1. prepare带参数执行，小数据量参数和超大数据量参数。
1. 不用关注批量执行，因为批量执行必然不包含select语句。
1. fetch测试需要关注带clob的场景。
1. 考虑可更新结果集和对数据敏感结果集的场景。
1. 流式fetch的场景。


  


1、dql、非dql 

2、directExecute、execute

3、fetch

4、

  


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