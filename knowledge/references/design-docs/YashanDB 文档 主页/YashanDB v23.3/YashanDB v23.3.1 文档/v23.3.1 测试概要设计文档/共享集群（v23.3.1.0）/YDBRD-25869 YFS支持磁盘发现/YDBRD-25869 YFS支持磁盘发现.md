Created by 吕雷奇 on 五月 22, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081)    ?    
  #YASHAN-305 YCS支持多盘，支持YFS管理YCS数据

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

该特性主要在使用场景是在通过支持本地临时表空间，解决在集群下使用临时表的性能问题；

主要涉及场景为单机（主备），集群，分布式下拦截；

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

*从研发概要设计中获取，列出从IR层级对外可以感知的特性，对应提供的功能点、函数、语法图、配置参数、视图、接口等*

*结合调研文档，如有与友商实现的规格差异，要体现出来*

*支持语法图：*

*2.1支持创建本地临时表，两种建表语句（for all | for leaf）*

![](https://conf.yasdb.com/download/attachments/133584601/image2023-11-15_15-43-17.png?version=1&modificationDate=1700034048000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA3NDgsImV4cCI6MTc4MjM4MTU0OH0.GbZzQ9axWUVp8H3cRUAY2pE6d9TWhiU22_bl1g84n8Y)

![](https://conf.yasdb.com/download/attachments/133584601/image2023-11-14_20-27-19.png?version=1&modificationDate=1699964691000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA3NDgsImV4cCI6MTc4MjM4MTU0OH0.GbZzQ9axWUVp8H3cRUAY2pE6d9TWhiU22_bl1g84n8Y)

*2.2 更改删除临时表空间SQL*

![](https://conf.yasdb.com/download/attachments/133584601/image2023-11-16_15-38-21.png?version=2&modificationDate=1700634293000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA3NDgsImV4cCI6MTc4MjM4MTU0OH0.GbZzQ9axWUVp8H3cRUAY2pE6d9TWhiU22_bl1g84n8Y)

*2.3删除（本地|共享）临时表空间SQL语句*

![](https://conf.yasdb.com/download/attachments/133584601/image2023-11-16_15-42-6.png?version=1&modificationDate=1700120376000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA3NDgsImV4cCI6MTc4MjM4MTU0OH0.GbZzQ9axWUVp8H3cRUAY2pE6d9TWhiU22_bl1g84n8Y)

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

- *支持单机和集群，不支持列存临时表已经分布式；*
- *不能删除当前正在使用的临时表空间；*
- *创建、更改本地临时表空间时不允许混合路径，即本地路径与磁阵路径混合使用；*
- *本地临时表空间语法中的for all和for leaf，在目前的作用为oracle 保持语法兼容；*
- *yasdb实现的dba_temp_files是从v$tempfile 获取，oracle 的是从控制文件中获取；*


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*单机和集群下支持创建、修改和删除临时表空间操作；*

单机和集群建库时创建临时表空间；

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.说明测试设计的整体思路，明确测试范围，规格限制。可以使用流程图、逻辑覆盖等方法体现测试思路。*

测试覆盖语法验证，覆盖表空间新增分支的语法分支验证，包括错误关键字位置的报错；

新增视图字段验证，触发视图字段变更，查看视图字段是否正确；

创建，修改和删除临时表空间的执行结果的正确性；

*2.关键数据、测试场景的构造方法，用例自动化方法，可能涉及的测试框架说明。*

*使用guider框架完成自动化*

*3.关联特性：如导入导出、审计、权限等*

*涉及导入导出和审计，权限、主备同步和系统权限；*

*4.分布式、集群、列表不支持的特性，需要考虑补充拦截用例*

只支持单机和集群，不支持分布式和列存；

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*性能、高可用、CT、KT、可维护性、可测试性、一致性、长稳、安全性、升级、DFR、压力*

*1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；*

*2.执行表达式和算子类的特性需求，需要考虑性能；*

*3.主备、容灾、存储等的特性需求，需要考虑可靠性；*

*4.外部常用语法、基础功能要考虑增加稳定性用例；*

*5.所有特性均需要考虑可维、可测，可要求研发提供必要的视图。*

*1、性能 涉及到问题单场景，使用本地临时表要性能可接受*

*2、高可用，单机和集群下在主机上执行创建全局临时表，备机点能看到表定义*

*3、需要在单机和集群下新增CT和KT场景*

*4、可维护性，可测试性，需要测试对应视图，需要加导入导出场景的测试*

*5、一致性，使用本地临时表的一致性测试；*

*6、*  *升级场景*

*5、DFR*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*使用guider实现用例自动化；*

*CT、KT使用testkill实现自动化*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*