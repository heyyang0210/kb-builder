Created by 马志宏 on 十二月 12, 2023

#   [YDBRD-21758 : DML，DDL附加日志添加rowid，xid](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#ydbrd-21627--%E6%95%B0%E6%8D%AE%E5%BA%93%E7%BA%A7%E9%99%84%E5%8A%A0%E6%97%A5%E5%BF%97-%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)    设计

IR链接：    [YDBRD-21758](https://jira.yasdb.com/browse/YDBRD-21758?src=confmacro)    -  DML，DDL附加日志添加rowid，xid  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-overview%E6%A6%82%E8%BF%B0)  

需求来源于DSG，  目前崖山的附加日志里，只有事务begin和end才记录xid，DML日志不记录xid，也不会记录rowid  。  xid如果不加，DML的解析会比较困难，尤其是长事务的中间位置开始解析，DSG希望在每个DML日志上增加xid。rowid主要是用来定位行位置的，类似主键的作用。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. DML的每条附加日志，都记录rowid，xid
1. DDL的附加日志，记录xid


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-interfaces%E6%8E%A5%E5%8F%A3)  

详见特性设计文档（    [DML, DDL增加rowid，xid（特性设计）](138556077.html)    ）

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

详见特性设计文档（    [DML, DDL增加rowid，xid（特性设计）](138556077.html)    ）

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

该IR拆解成一个完整的SR：    [YDBRD-21830](https://jira.yasdb.com/browse/YDBRD-21830)    ，SR特性设计文档    [DML, DDL增加rowid，xid（特性设计）](138556077.html)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#51-architecture%E6%9E%B6%E6%9E%84)  

###   [5.2 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#52-dfx%E8%AE%BE%E8%AE%A1)  

###   [5.3 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#53-%E5%85%B6%E4%BB%96)  

  


##   [6. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*