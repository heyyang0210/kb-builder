Created by 孔珂煜, last modified on 十二月 15, 2023

IR链接：    [YDBRD-11464](https://jira.yasdb.com/browse/YDBRD-11464?src=confmacro)    -  distinct优化  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

distinct及group by需要键值序列做去重，键值数量可缩减来加快执行效率；

缩减规则：

1. 当键值序列出现在谓词中，且键值符合等价类规则时，键值数量可缩减；
1. 当键值序列出现常量，但不全是常量时，常量可消除；
1. 当键值序列全部为常量时，保留一个常量；
1. 当去重列包含主键列和唯一键索引时，主键列已要求插入的数据非重复，返回的结果不会有重复值，可进行优化。


**支持的部署形态**  ：单机，集群

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

*从研发概要设计中获取，列出从IR层级对外可以感知的特性，对应提供的功能点、函数、语法图、配置参数、视图、接口等*

*结合调研文档，如有与友商实现的规格差异，要体现出来*

对外感知不到

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1.不支持多表场景下的distinct消除

2.不支持唯一键索引的distinct消除

3.同时存在distinct和group by时，当分组列时去重列的子集时，消除distinct，保留group by

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

优化器对distinct进行优化，不区分部署形态

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.说明测试设计的整体思路，明确测试范围，规格限制。可以使用流程图、逻辑覆盖等方法体现测试思路。*

*2.关键数据、测试场景的构造方法，用例自动化方法，可能涉及的测试框架说明。*

*3.关联特性：如导入导出、审计、权限等*

*涉及新增数据库语法，需要考虑系统权限和系统审计； *  --本特性不涉及

*涉及数据库对象的特性测试，需要考虑对象级权限、对象级审计、导入导出、对象安全访问和主备同步实现；*  --本特性不涉及

*涉及新增数据类型，需要考虑在已支持的各类场景和对象中使用、导入导出等； *  --本特性不涉及

*4.分布式、集群、列表不支持的特性，需要考虑补充拦截用例  *  --本特性不涉及

|输入条件|  
|
|---|---|
|表类型|普通表,分区表|
|投影列类型|全部数据类型,常量,sysdate，systimstamp,伪列：rownum，level等,列重复投影：select c1,c1 ...,外部引用的投影列,自定义函数,表达式列,高级包：dbms_random等,特殊值：null|
|数据来源|单表,子查询,join(本次需求不支持，要拦截)|
|查看计划的方式|autotrace,explain|
|dml|insert...select,update,delete的where条件有select|
|where|列的等价类,列 = 常量,限制结果集只有1行|
|规格拦截|只支持主键,唯一索引不支持|


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*性能、高可用、CT、KT、可维护性、可测试性、一致性、长稳、安全性、升级、DFR、压力*

*1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；*   --本特性不涉及

*2.执行表达式和算子类的特性需求，需要考虑性能；*

*3.主备、容灾、存储等的特性需求，需要考虑可靠性； *  --本特性不涉及

*4.外部常用语法、基础功能要考虑增加稳定性用例； *  --本特性不涉及

*5.所有特性均需要考虑可维、可测，可要求研发提供必要的视图。*   --本特性不涉及

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略、自动化看护策略*

*测试框架满足度*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*