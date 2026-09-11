Created by 陈晓晴, last modified on 六月 07, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#1-overview概述)  

目前列存LOB仅支持inline的，最大32000字节，使用场景非常受限，需要对此规格进行扩展。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#2-features功能特性)  

1，支持outline LOB，扩展LOB最大Size。

      Oracle规格：    `(4 gigabytes - 1)*(space usable for data in the LOB block)`  

  [      https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/where-to-use-LOBs.html#GUID-EF55494E-BC8C-454C-AF89-4ADFC723D01A](https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/where-to-use-LOBs.html#GUID-EF55494E-BC8C-454C-AF89-4ADFC723D01A)  

    目前测试可按IR规格，支持4GB。

2，支持列表outRow lob的删除。



##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#4-limitations功能限制)  

1. 不支持分布式下创建outline lob。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#5-detail-design详细设计)  

  


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#6-testcases自测用例)  

1.ddl：普通列表、分区列表的outline clob、blob创建，以及分区表的ddl操作。

2. 普通列表、分区列表的outline clob、blob插入、查询、删除。跨分区更新。

3.列表的outline lob逻辑日志。

4.outline lob表的导入。

5. 使用lob api操作大lob，进行插入、查询，不支持更新相关的api接口。其他接口都可用于测试，但使用api操作列存inline lob的表现可能稍有差异。

  [https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/JDBC%E9%A9%B1%E5%8A%A8/JDBC%E6%8E%A5%E5%8F%A3%E6%94%AF%E6%8C%81%E8%AF%B4%E6%98%8E/java.sql.Clob](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/JDBC%E9%A9%B1%E5%8A%A8/JDBC%E6%8E%A5%E5%8F%A3%E6%94%AF%E6%8C%81%E8%AF%B4%E6%98%8E/java.sql.Clob)  

  


  


  


  
