Created by 范瑜, last modified on 四月 22, 2024

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

*需求与场景概述*

*需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分 单机行执行 和 单机列执行*

IR：     [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b087](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b087)    ?    
  #YASHAN-311 yasldr支持gis对象导入到yashandb

SR:     [https://pingcode.yasdb.com/pjm/items/661e7559fd997db58adae95e](https://pingcode.yasdb.com/pjm/items/661e7559fd997db58adae95e)    ?    
  #YDBRD-26433 【yasldr】支持gis对象以csv文件导入到yashandb



需求来源： 市场项目数生科技

需求描述： postGIS含有geometry类型的表，导出为csv后，导入YashanDB

交付形态：单机

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

*从研发概要设计中获取，列出从IR层级对外可以感知的特性，对应提供的功能点、函数、语法图、配置参数、视图、接口等*

*结合调研文档，如有与友商实现的规格差异，要体现出来*

|导入|yasdb(yasldr)|postgresql(copy)|差异点|
|---|---|---|---|
|空间数据类型|  
|  
|  
,  
|


  


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

*从研发概要设计中获取*

*待补充*

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求与其他特性的关联场景*

**需求主要应用场景：**

（1）使用yasldr将空间数据类型的csv文件导入到数据

**与其它特性关联场景：**

（1）容错

（2）use_native_type

（3）组网：单机（支持）、分布式、集群  （支持？）

（4）导入方式：客户端、服务端

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

本次测试主要从以下方面考虑：

（1）功能测试：

- 根据空间数据类型，需覆盖所有支持空间数据类型， 注意维度、各个坐标数据类型是float（需覆盖边界值、超过边界值、特殊值的inf、nan、inf等）、 取值为empty、最大长度是4GB、
- 根据容错， 需覆盖表列空间类型与csv中的类型不一致、csv文件中空间数据类型格式不正确（需覆盖所有空间数据类型）等
- 结合use_native_type--是否有影响？
- 结合组网：单机（支持）、分布式、集群  （支持？）
- 导入方式：客户端、服务端（  是否支持？  ）


（2）并发测试：不涉及

（3）可靠性测试：在正常/异常场景下循环重复导入导出， 检查是否有内存泄露、资源未释放等

（4）性能测试：摸底导入速度

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

（1）并发测试：不涉及

（2）可靠性测试：在正常/异常场景下循环重复导入导出， 检查是否有内存泄露、资源未释放等

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

测试策略：优先验证基本功能再验证性能

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

  
