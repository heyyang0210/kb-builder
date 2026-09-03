Created by 贺天欢, last modified on 十二月 04, 2023

IR链接：    [YDBRD-19683](https://jira.yasdb.com/browse/YDBRD-19683?src=confmacro)    -  yasql支持执行失败自动退出  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

yasql当前默认执行失败，报错但未退出。    
  如果类比Oracle的功能，我们的实施经验是进到sqlplus命令行后，设置以下参数    
  whenever sqlerror exit sql.sqlcode;    
  可以让sql执行报错后立即报错退出的。    
    
  使用场景：    
  部分业务通过yasql执行一批sql，希望中间失败就报错退出，不往下执行后续的sql。

单机  ,     分布式  ,     集群

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

*作用：用*  *whenever sqlerror命令设置异常处理方式，继续执行或退出yasql*

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

*从研发概要设计中获取*

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求本身的主要应用场景*

*需求与其他特性的关联场景*

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.说明测试设计的整体思路，明确测试范围，规格限制。可以使用流程图、逻辑覆盖等方法体现测试思路。*

*2.关键数据、测试场景的构造方法，用例自动化方法，可能涉及的测试框架说明。*

*3.关联特性：如导入导出、审计、权限等*

*涉及新增数据库语法，需要考虑系统权限和系统审计；*

*涉及数据库对象的特性测试，需要考虑对象级权限、对象级审计、导入导出、对象安全访问和主备同步实现；*

*涉及新增数据类型，需要考虑在已支持的各类场景和对象中使用、导入导出等；*

*4.分布式、集群、列表不支持的特性，需要考虑补充拦截用例*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*性能、高可用、CT、KT、可维护性、可测试性、一致性、长稳、安全性、升级、DFR、压力*

*1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；*

*2.执行表达式和算子类的特性需求，需要考虑性能；*

*3.主备、容灾、存储等的特性需求，需要考虑可靠性；*

*4.外部常用语法、基础功能要考虑增加稳定性用例；*

*5.所有特性均需要考虑可维、可测，可要求研发提供必要的视图。*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略、自动化看护策略*

*测试框架满足度*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*