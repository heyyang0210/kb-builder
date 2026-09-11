Created by 高亚宁, last modified on 十月 23, 2024

|  
|模块|测试场景|预期|测试结果|
|---|---|---|---|---|
|1|高级包|schema名称为小写时，调用高级包创建ystream server，添加/删除表，查看dba_YSTREAM_TABLES中的shema是否区分大小写|创建ystream server，添加/删除表都成功，dba_YSTREAM_TABLES中会区分大小写|通过|
|2|  
|表名为小写时，调用高级包添加/删除该表，查看dba_YSTREAM_TABLES中的表名是否区分大小写|添加/删除该表成功|通过|
|3|  
|server name为小写时，创建server，查看v$ystream_server中的servername是否区分大小写|创建成功，不对双引号做特殊处理|通过|
|4|  
|调用高级包强制stop server|stop成功，v$ystream_server中的状态是stopped|通过|
|5|  
|在数据库里创建很多表，几十万以上，创建1000个scheme, 在YStream里指定1000个scheme，执行DBMS_YSTREAM_ADM.START启动server|快速启动成功|通过|
|6|  
|schema名称和表名都超长，64位，启动server|启动成功|通过|
|7|  
|server名称、schema名称、表名长度64位，启动server解析ddl，dml业务：,1. server名称、schema名称（小写）、表名长度都是64位，启动server解析
1. ddl：列名和约束名称长度64位，解析
1. ddl：comment名称长度64位，解析
|  
|通过|
|8|  
|调用DBMS_YSTREAM_ADM.CREATE创建ystream server，connect_user名称64位带引号时，创建|创建成功|通过|
|9|logminer|重启了一次rmq_connect之后，下一个任务启动，message一直是空，不读取和发送数据|解析成功|通过|
|10|  
|schema名称、表名长度64位，启动server解析ddl，dml业务：,1. server名称、schema名称（小写）、表名长度都是64位，启动server解析
1. ddl：列名和约束名称长度64位，解析
1. ddl：comment名称长度64位，解析
|解析成功|通过|
