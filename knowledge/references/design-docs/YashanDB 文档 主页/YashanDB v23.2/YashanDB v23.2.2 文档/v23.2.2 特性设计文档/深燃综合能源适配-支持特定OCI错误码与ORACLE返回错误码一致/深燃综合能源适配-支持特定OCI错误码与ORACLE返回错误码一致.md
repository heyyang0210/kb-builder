Created by 方少奎, last modified on 四月 16, 2024

需求描述：    
  用户程序中有根据错误码做的判断和操作，OCI返回的错误码需要与对应ORACLE的错误码保持一致，否则返回YAS的错误码无法匹配    
    
  需求范围：    
  OCI返回的错误码总共25个需保持一致

  


YashanDB错误码官方文档：

  [YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%94%99%E8%AF%AF%E7%A0%81.html)  

oracle错误码官方文档：

  [ORA Database Error Messages (oracle.com)](https://docs.oracle.com/en/error-help/db/ora-index.html)  

  


|Yashan错误码说明|Yashan 错误码|ORACLE 错误码|ORACLE错误码说明|
|---|---|---|---|
|### YAS-00422,**Message**  ：send message to node %s with link level %u timeout %ums, %s,**Action**  ：发送超时，请重试。,### YAS-00427,**Message**  ：take the link %u_%u_%u failed: %s,**Action**  ：请根据报错内容进行处理：,- 报not reserved时，属内部错误，请联系我们的技术支持解决。
- 报take link timeout时，为等待有效链路超时，请重试。
,### YAS-02024,**Message**  ：lock wait timeout, wait time %u milliseconds,**Action**  ：上锁超时，请稍后重试。,### YAS-03705,**Message**  ：%s timeout, exceeded % PRIu32 seconds,**Action**  ：强制转换超时，请重试。,### YAS-05706,**Message**  ：ycs communication timeout,**Action**  ：请检查部署环境的网络，检查连接信息或联系我们的技术支持解决。,### YAS-04457,**Message**  ：send runtime filter timeout,**Action**  ：runtime filter发送超时，请检查网络状态。|422,427,2024,3705,4457,5706|12535|ORA-12535: TNS: 操作超时,TNS:operation timed out,---
,### Cause,The requested operation could not be completed within the time out period.|
|### YAS-00413,**Message**  ：%s timeout,**Action**  ：网络超时，检查部署环境的网络质量。,### YAS-04155,**Message**  ：%s timeout,**Action**  ：网络超时，请重试。,### YAS-04160,**Message**  ：cluster parallel connection expired,**Action**  ：集群连接过期，请重试,  
|413,4155,4160|12170|ORA-12170：TNS:连接超时    
  错误说明：多为网络不通或服务器端更改了IP所致，网络不通tnsping 服务器的SID看能不能同，服务器IP改了要同步修改Listener和Service的设置,Cannot connect.     timeout_type     timeout of     timeout     for     host_port. (CONNECTION_ID=connection_id),- timeout_type: The timeout type (i.e. TCP, OUTBOUND_CONNECT, RECEIVE).
- timeout: The timeout value.
- host_port: The host and port that could not be connected to.
- connection_id: The connection ID.
,  
,---
,### Cause,The connection request could not be completed within the allotted time interval. This may be a result of network or system delays, or it may indicate a denial of service attack on the database server.|
|  
|  
|12514|ORA-12514：TNS:监听程序当前无法识别连接描述中请求的服务。,Cannot connect to database. Service     service_name     is not registered with the listener at     host_port. (CONNECTION_ID=connection_id),- service_name: The name of the database service.
- host_port: The host and port that the Oracle Database listener process is on.
- connection_id: The connection ID.
|
|  
,  
|  
|12500|ORA-12500: TNS: 监听程序无法启动专用服务器进程,TNS:listener failed to start a dedicated server process,---
,### Cause,Starting a dedicated server process failed. Either the executable could not be found or the environment was set up incorrectly.|
|  
|  
|12523|ORA-12523: TNS: 监听程序无法找到适用于客户机连接的例程,TNS:listener could not find instance appropriate for the client connection,### Cause,The listener could not find any available (database) instances, that are appropriate for the client connection.|
|  
|  
,  
|12541|ORA-12541: TNS:无监听程序,Cannot connect. No listener at     host_port.,- host_port: The host and port that the Oracle Database listener process is on.
,  
,---
,### Cause,The connection request could not be completed because either the database listener process was not running on the specified host and port, or an Interprocess Communication (IPC) protocol connection was attempted but there was no listener for the specified key running on the local machine. PL/SQL applications using UTL packages can also get this error if the external server process is not listening on the specified address.|
|  
|  
|12528|ORA-12528: TNS: 监听程序: 所有适用例程都无法建立新连接,TNS:listener: all appropriate instances are blocking new connections,---
,### Cause,All instances supporting the service requested by the client reported that they were blocking the new connections. This condition may be temporary, such as at instance startup.|
|  
|  
|12571|ORA-12571: TNS: 包写入程序失败,TNS:packet writer failure,---
,### Cause,An error occurred during a data send.|
|### YAS-00405,**Message**  ：protocol error, failed to connect to %s, because %s,**Action**  ：协议错误，请检查部署环境的网络或客户端版本是否配套，检查连接信息或联系我们的技术支持解决。|405|12560|ORA-12560: TNS: 协议适配器错误,Database communication protocol error.,---
,### Cause,A lower level communication protocol adapter error occurred.|
|  
|  
|1033|ORA-01033: ORACLE 正在初始化或关闭过程中,ORACLE initialization or shutdown in progress,---
,### Cause,An attempt was made to log on while Oracle is being started up or shutdown.|
|  
|  
|1089|ORA-01089: 正在进行紧急关闭 - 不允许进行任何操作,## ORA-01089,  
  immediate shutdown or close in progress - no operations are permitted,---
,### Cause,The SHUTDOWN IMMEDIATE command was used to shut down a running Oracle instance, or CLOSE IMMEDIATE was used to shut down a pluggable database, so your operations have been terminated.|
|  
|  
|1090|ORA-01090: 正在进行关闭 --- 不允许连接,shutdown in progress - connection is not permitted,---
,### Cause,The SHUTDOWN command was used to shut down a running ORACLE instance, so you cannot connect to ORACLE.|
|  
|  
|1092|ORA-01092: ORACLE 例程终止。强行断开连接,ORACLE instance terminated. Disconnection forced,---
,### Cause,The instance this process was connected to was terminated abnormally, probably via a shutdown abort. This process was forced to disconnect from the instance.|
|  
|  
|3113|ORA-03113: 通信通道的文件结束    
  错误说明：数据库连接中断。,end-of-file on communication channel,---
,### Cause,The connection between the Client and Server process was broken. The cause may be that the database instance experienced a maintenance or unplanned outage, or that the Server process had a fatal error, or that the network connection was interrupted.|
|### YAS-00402,**Message**  ：failed to %s, %s,**Action**  ：根据具体报错信息和系统错误码，调整系统配置或数据库参数。|402|12154|ORA-12154:   Cannot connect to database|
|  
|  
|3114|ORA-0  3114：  not connected to ORACLE,The connection between the Client and Server process did not exist. This is likely the result of an earlier ORA-03113 error. The cause may be that the database instance experienced a maintenance or unplanned outage, or that the Server process had a fatal error, or that the network connection was interrupted.|
|  
|  
|1034|ORA-01034: ORACLE 不可用,The Oracle instance is not available for use. Start the instance.,---
,### Cause,An attempt was made to connect to an Oracle database or ASM or ASMIOSERVER instance, but the instance was not available. The instance was either incorrectly specified or was shut down, failed to start, or was aborted.|
|### YAS-02094,**Message**  ：current session has been killed or canceled,**Action**  ：连接已断开，尝试重新连接。,  
|2094,  
|3135,  
|ORA-0  3135：连接失联,connection lost contact,1. Server unexpectedly terminated or was forced to terminate.
1. Server timed out the connection.
|
|### YAS-00406,**Message**  ：connection is closed,**Action**  ：连接已关闭，请退出并重新连接服务器。,  
|406|12537|ORA-12537: TNS: 连接关闭,TNS:connection closed,---
,### Cause,"End of file" condition has been reached; partner has disconnected.|
|  
|  
|2399|ORA-0  2399：  exceeded maximum connect time, you are being logged off,超过最大连接时间，您正在注销|
|  
|  
|2396|ORA-02396：exceeded maximum idle time, please connect again,超过最大空闲时间，请重新连接|
|  
|  
|1012|ORA-01012: 没有登录，没有连接到Oracle,not logged on,---
,### Cause,A host language program issued an Oracle call other than OLON or OLOGON, without being logged on to the Oracle. This occurred when a user process attempted to access the database after the instance it was connected to terminated, forcing the process to disconnect.|
|  
|  
|8001|ORA-08001：|
|  
|  
|12543|ORA-12543：TNS:destination host unreachable    
  触发场合：DBLINK连接某数据库引起    
  错误说明：大多为系统服务器没有关防火墙引起,TNS:destination host unreachable,---
,### Cause,Contact can not be made with remote party.|
|### YAS-04328,**Message**  ：can only select from fixed tables/views,**Action**  ：只允许对非物理表进行查询，不允许进行修改。|4328|02030|ORA-02030: 只能从固定的表/视图查询    
  说明：当把动态性能v$授予权限给用户的时候报的错误，只能赋值视图，例如v_$session。    
  另外授予x$也会报此错误，x$表只能在sys用户下查询，且无视图。,can only select from fixed tables/views,---
,### Cause,An attempt is being made to perform an operation other than a retrieval from a fixed table/view.|
|### YAS-02030,**Message**  ：unique constraint%s violated,**Action**  ：删除唯一性约束或者不要插入这一行。|2030|1|ORA-00001,unique constraint (schema_name.constraint_name) violated,- schema_name: The schema name where the constraint resides.
- constraint_name: The name of the constraint, from either the ALL_CONSTRAINTS or ALL_INDEXES view.
,  
,---
,### Cause,An UPDATE, INSERT or MERGE statement attempted to update or create a record that duplicated values limited by a unique constraint. A unique constraint can be implemented as an explicit unique constraint, a unique index, or a primary key.,Consider the case where a table has a unique constraint on columns FIRSTNAME and LASTNAME. Because of this constraint, it is not possible to insert a row containing values of FIRSTNAME and LASTNAME that are identical to the values of these columns in an existing table row.|
