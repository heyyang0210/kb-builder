Created by 马志宏, last modified on 十月 31, 2023

#   [YDBRD-21664 : 非指令方式的CRC校验](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：    [YDBRD-21664](https://jira.yasdb.com/browse/YDBRD-21664?src=confmacro)    -  物理备份集支持非指令方式的CRC校验  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-overview%E6%A6%82%E8%BF%B0)  

使用不支持crc指令的机器导出物理备份集，在其他机器上恢复时报错，原因是crc全部记为-1了。此外，不支持crc指令的机器上将不做crc校验，存在数据损坏无法校验的风险。

因此需要在数据库内部实现一套crc算法，在非指令机器上代替指令crc。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 在不带指令集CRC的机器上，使用内部算法执行CRC
1. 内部算法的CRC结果与指令集CRC相同


  [  
3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-interfaces%E6%8E%A5%E5%8F%A3)  

无

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

详细约束见特性设计文档（    [非指令方式的CRC校验（特性设计）](122078725.html)    ）

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

该IR相当于一个完整的SR，详细设计见特性设计文档（    [非指令方式的CRC校验（特性设计）](122078725.html)    ）

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#51-architecture%E6%9E%B6%E6%9E%84)  

###   [5.2 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#52-dfx%E8%AE%BE%E8%AE%A1)  

###   [5.3 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#53-%E5%85%B6%E4%BB%96)  

  


##   [6. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  
