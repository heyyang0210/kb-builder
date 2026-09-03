Created by 马志宏, last modified on 十月 31, 2023

#   [YDBRD-18051 : 增量RESTORE](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：    [YDBRD-18051](https://jira.yasdb.com/browse/YDBRD-18051?src=confmacro)    -  增量备份集可以逐个执行restore  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-overview%E6%A6%82%E8%BF%B0)  

崖山目前的增量备份集恢复是自动查找增量备份集，一次性恢复的，而云臻需要自己管理每个增量备份集，单独对某个增量备份集做restore的功能。

即使某次restore之后，数据库做了重启，也可以接着进行下次restore。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 支持单独restore基线备份集，只恢复datafile，不恢复归档
1. 在restore某次基线备份后，可以接着restore下一个增量备份集
1. 最后一次增量备份的恢复，需要将归档和control恢复出来，然后recover


  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-interfaces%E6%8E%A5%E5%8F%A3)  

详见特性设计文档（    [增量备份支持指定基线（特性设计）](133581151.html)    ）

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**详见特性设计文档（**    [增量备份支持指定基线（特性设计）](133581151.html)    **）**

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

该IR拆解成一个完整的SR：    [YDBRD-21379](https://jira.yasdb.com/browse/YDBRD-21379?src=confmacro)    -  【23.2】增量备份集可以逐个执行restore  完成  ，SR设计文档    [增量备份支持指定基线（特性设计）](133581151.html)  

  


###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#51-architecture%E6%9E%B6%E6%9E%84)  

###   [5.2 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#52-dfx%E8%AE%BE%E8%AE%A1)  

###   [5.3 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#53-%E5%85%B6%E4%BB%96)  

##   [6. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*