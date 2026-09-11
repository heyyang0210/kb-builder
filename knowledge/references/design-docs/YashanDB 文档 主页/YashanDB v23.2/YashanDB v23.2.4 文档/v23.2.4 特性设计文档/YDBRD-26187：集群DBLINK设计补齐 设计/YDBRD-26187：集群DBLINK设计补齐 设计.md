Created by 朱月婷, last modified on 七月 16, 2024

写在前面：单机dblink功能集群天然适配

逻辑上单机和集群功能应对齐，但有些场景由于集群目前的限制不支持，故dblink也不支持

如：select seq.nextval, inst_id from gv$instance;

涉及gv视图则会下推，走序列化流程，但序列化不支持sequence表达式，故报错。

  


单机设计文档：

同义词：    [YDBRD-25316 支持为DBLINK创建同义词设计 - 苏凡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150607733)  

序列：    [YDBRD-27844：DBLINK支持SEQUENCE 设计文档 - 朱月婷 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147779887)  

LOB：    [详细设计文档-YDBRD-26126，DBLINK支持查看oracle lob数据 - 徐伟 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150616299)  

存储过程：    [DBLINK连接ORACLE支持远程调用Oracle的存储过程-特性设计 - 彭灵继 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150606701)  