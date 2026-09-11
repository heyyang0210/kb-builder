Created by 高亚宁, last modified on 十月 21, 2024

# 1.   **概述**

本文描述逻辑备机支持switchover的测试设计

# 2.   **需求分析**

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b74c7009f91eb87f2cfcc](https://pingcode.yasdb.com/ship/ideas/660b74c7009f91eb87f2cfcc)    ?    
  #YASHAN-2503 逻辑备机增强

SR链接：    [https://pingcode.yasdb.com/pjm/items/67062c87e489dd0868f2c22a](https://pingcode.yasdb.com/pjm/items/67062c87e489dd0868f2c22a)    ?    
  #YDBRD-33573 逻辑备机支持switchover

开发文档：  [(2502) 逻辑备机支持switchover | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673ed19c728206efb9333948)  

需求来源：  产品化需求

部署形态：单机

功能说明：逻辑备机支持switchover，支撑滚动升级的能力

|属性|场景名称|方案设计|是否需要测试|测试方案|
|:---|:---|:---|:---|:---|
|功能|主库需要等待当前正在进行的事务结束，阻塞新的事务。|1. kill所有的会话
1. 阻塞新的会话接入
1. 关闭执行业务的后台线程。例如：job、mmon等
|是|1. 观测逻辑备机switchover的条件和限制
1. 逻辑备机switchover成功前后，观测旧主机的业务表现和线程状态，逻辑备机升主后的角色变化，有无数据丢失
1. 主备切换后，新主做业务，redo发送和接收是否正常，新备能否正常做逻辑回放
1. switchover过程中在不同阶段构造异常，观测是否能正常恢复
1. 模拟滚动升级操作，测试是否能支撑滚动升级
|
|功能|等待备库完全同步主库。|同物理备库保持一致，将备库的replay point发送给主库，同主库的flush point作比较。如果两者一致，则说明备库已经完全同步主库。|是||
|功能|为新的逻辑备库构建Ystream元数据。|因为主库同逻辑备库是逻辑同步关系，所以两者之间表的元数据不是完全一致，构建逻辑备库之前需要同步元数据，即逻辑备库将自己的元数据信息发送给主库。|是||
|功能|确定逻辑同步的日志点。|逻辑备库有主库的redo日志，但是主库没有逻辑备库的redo日志，角色切换之后，新主从哪条日志开始往逻辑备库传输。这个时候就需要逻辑备库告诉旧主从哪里传输日志。|是||
|功能|standby redo和online redo之前的切换。|- standby redo：逻辑备机产生的redo写在该redo文件。
- online redo：主库产生的redo文件写在该redo文件。
,随着角色的切换，写的日志文件也发生变化，主库需要从standby文件切换到online文件。新的逻辑备库需要从online文件切换到standby。|是||
|性能|switchover的耗时主要集中在逻辑redo的回放|支持并行回放后，性能会有大幅度提升。|否||
|可靠性|switchover执行一半异常，出现了两个数据库都是逻辑备库。|这种情况下，只能执行failover操作产生新的主库。两者可以继续建立逻辑备机的关系，正常同步。|是||
|周边配合|权限|同物理备机执行switchover的权限保持一致。|是||


###   [规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- 指定  *db_name*  方式构建的逻辑备库，会修改数据库的  *db_name*  和  *dbId, *  open逻辑备机时必须resetlogs
- 使用  *keep identity*  方式构建的备机，不会修改数据库的  *db_name*  和  *dbId，*  仅用于滚动升级场景
- 使用  *keep identity*  方式不需要加resetlogs
- 使用  *keep identity*  方式构建的备机，只能执行一次  *Switchover（主备断连）*
- 使用  *keep identity*  方式构建的备机，不能执行备份
- 执行  *Switchover*  时，要求主库至少存在三个standby redo
- 指定  *db_name*  方式构建的逻辑备库，逻辑备机升主后，除旧主外，原有的物理备机或者是逻辑备机都将出现异常，需要重新构建
- 指定  *db_name*  方式构建的逻辑备机，元数据构建期间，主库的ddl业务执行报错，dml正常执行


# 3.   **测试设计方法**

1. 新增ALTER DATABASE RECOVER TO LOGICAL STANDBY db_name;语法采用等价类划分法设计
1. 逻辑备机switchover功能、异常场景等使用场景法和错误推测法设计
1. DFX覆盖


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳||
|一致性||
|三方测试工具    
  (sqltest，sqlancer)||
|安全||
|DFR||
|HA|涉及|
|压力||
|性能|暂不涉及，不支持并行回放|
|可维护性|涉及|


# 4.   **详细测试设计**

### 4.1 新增语法测试

mount切换逻辑备机：

**方法1（新增）：**

ALTER DATABASE RECOVER TO LOGICAL STANDBY db_name;

ALTER DATABASE OPEN RESETLOGS;

**方法2（仅适用于滚动升级，只能做一次switchover）：**

ALTER DATABASE RECOVER TO LOGICAL STANDBY KEEP identity;

alter database open;

|编号|输入条件|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|
|1|ALTER DATABASE RECOVER TO LOGICAL STANDBY db_name;|正确语法：ALTER DATABASE RECOVER TO LOGICAL STANDBY db_name;，执行后查看逻辑备机的  *db_name*  和  *dbId*  ，期望是和与原来不同，与指定的一致|关键字缺失或拼写错误|新增语法用例，功能复用现有用例，把KEEP identity替换成db_name|
|2|||db_name格式错误：带引号，为空||
|3|||db_name含特殊字符||
|4|||db_name长度超过64位|和DB_UNIQUE_NAME的长度一致？——  不一样，与建库时一致，64位|
|5|||未执行逻辑备机build，物理备机mount状态下上执行该语句||
|6|||open/nomount时，在逻辑备机上执行该语句||
|7|||执行该语句后，执行alter database open||
|8|||执行该语句后，再执行  **alter database convert to physical standby;**  切换成物理备机||
|9|||执行该语句后，逻辑备机连续做2次switchover，期望是2次都成功||
||||指定  *db_name*  方式构建的逻辑备机，元数据构建期间，主库的ddl业务执行报错，dml正常执行||
||||db_name设置为keep||
|10|ALTER DATABASE RECOVER TO LOGICAL STANDBY KEEP identity;|正确语法：ALTER DATABASE RECOVER TO LOGICAL STANDBY db_name;，执行后查看逻辑备机的  *db_name*  和  *dbId*  ，期望是和与原来相同|语法错误：,关键字缺失或拼写错误|语法复用现有用例，新增功能用例|
||||未执行逻辑备机build，物理备机mount状态下上执行该语句||
|11|||open/nomount时，在逻辑备机上执行该语句||
|12|||执行该语句后，执行alter database open RESETLOGS||
||||执行该语句后，再执行  **alter database convert to physical standby;**  切换成物理备机||
||||执行该语句后，逻辑备机连续做2次  **switchover**||
||||执行该语句后，在逻辑备机上做备份，报错||




### 4.2 功能测试

测试观测点：

- 各种场景，逻辑备机switchover是否成功
- 逻辑备机switchover成功后，sys/非sys用户是否能正常读写，V$LOGSTDBY_PROGRESS显示的进度是否正确
- 旧主机是否降备成功，变为guard模式(只有sys可写)，降备后的旧主机的状态，能否正常同步新主机的业务
- 是否能支撑滚动升级


|序号  
|测试场景|预期|备注|
|---|---|---|---|
|1|主机执行ddl/dml时，逻辑备机做switchover，切换到新主做业务，查看旧主机的状态、角色，查看原有物理备机的状态、角色，观测新旧主机的  standby redo和online redo是否切换|旧主机的角色是logical standby,能正常逻辑回放,新主机非sys用户能正常执行业务,原有物理备机need repair，需要重新build,随着角色的切换，写的日志文件也发生变化，主库需要从standby文件切换到online文件，新的逻辑备库需要从online文件切换到standby|  
|
|2|主机有溢出事务时，逻辑备机  switchover|成功|  
|
|3|不开启逻辑回放，主机做大量业务，逻辑备机落后很多时，开启逻辑回放，做  switchover，查看  V$DATABASE中的字段SWITCHOVER_STATUS|switchover过程中，主机  上SWITCHOVER_STATUS为PREPARING SWITCHOVER，备机上为PREPARING DICTIONARY,switchover  成功|显示主备切换的状态（  新增元数据同步状态  ）：,- ***PREPARING SWITCHOVER***   ： 在主数据库上，此状态表示正在从逻辑备用数据库接收数据字典，以准备切换到逻辑备用角色。
- ***PREPARING DICTIONARY***   ：在逻辑备用数据库上，此状态表示数据字典正在发送到主数据库，以准备切换到主角色。
|
|4|kill重启逻辑备机，不开启逻辑回放，做  switchover|报错|  
|
|5|kill主机，逻辑备机  switchover|报错|  
|
|6|主机做业务—>逻辑备机做  switchover—>新主做业务，循环多次执行|switchover成功|  
|
|7|大数据量下，做2次switchover，主机的standby redo有active状态，执行switchover|报错|待定    
|
|8|删除主机的standby redo（小于3个），逻辑备机switchover，在主机新增3个standby redo，逻辑备机再次switchover|第一次报错,第二次成功|  
|
|9|逻辑备机  switchover过程中，kill主机重启，尝试恢复主备状态，覆盖4种情况|switchover报错|Switchover时，如果执行了一半之后出现了异常，这种情况下，主要分为几种情况,***元数据构建之前主库或者备库异常***,该场景就是正常的逻辑同步，异常之后，重启启动挂掉的节点即可，不会出现数据库异常。,***元数据构建时主库宕机***,这种情况下，主库的aux$可能已经插入了部分数据。所以每次进行元数据构建时需要先清空aux$表，避免出现重复元数据。,逻辑备库这种情况下也是需要重启数据库到open，因为逻辑回放线程被关闭了。,***降备后逻辑备库宕机***,这种情况下，出现了两个逻辑备机，这个时候就需要人为介入，手动将数据库的升级，执行failover。,这种场景下，是可以保证两个数据库之间的逻辑关系，因为新的逻辑备机已经构建了元数据，并且持久化了日志同步点，是可以跟新主建立逻辑同步关系的，能够正常进行逻辑同步。,这种情况下一般是在逻辑备库端执行failover，而不是旧主执行。,***降备后旧主宕机***,没有影响，数据库角色已经改变，并且完成了元数据的同步，持久化了日志同步点，旧主挂点不会异常备库的升主。|
|10|备份恢复前后，做failover/switchover|备份恢复成功，failover/switchover成功|yasft\ha\ha_heap\testcase\ha_sit\test_sit_switchover_backup.py|
|11|在逻辑备机上执行主备倒换命令，alter database switchover;执行ctl+z中断命令，再次连接该备节点，执行sql 命令alter database switchover|第一次失败，第二次成功|yasft\ha\ha_heap\testcase\ha_sit\test_sit_bug972.py|
|12|主机跑tpcc，逻辑备机反复switchover|成功|yasft\ha\ha_heap\testcase\ha_sit\test_tpcc_switchover.py|
|13|逻辑备机  switchover的权限：sys、dba、sysdba、sysbackup、ystream等用户分别做switchover|只有sys用户能成功，其他用户报权限不足|yasft\ha\ha_heap\testcase\ha_sit\test_sit_ha_priviliege.py|
|14|模拟滚动升级场景,1. 主库做一次全量备份。
1. 暂停物理备机回放。
1. 创建standby redo，执行build操作构建逻辑备机的。
1. 执行alter database recover to logical standy keep identity构建修改数据库的角色。
1. 执行alter database open。
1. 开启逻辑回放。
1. 主机做业务
1. 执行switchover。
1. 使用全量备份集恢复旧主，restore恢复过程中需要手动降为备库。
1. 新主机做业务，查看旧主机能否正常物理回放
|流程能正常进行||


# 5.  ** **  **测试用例设计**

文本用例

# 6.   **测试框架设计**

使用regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机部署一主一物理备一逻辑备  
|


8.   **测试工作量评估**    
共计10人天：

1. 研发串讲，测试调研，测试设计+评审——2天
1. 测试执行+用例自动化+用例调试连跑——6天
1. 问题单回归，上车CI分析，资料测试——2天


暂定2025/1/6上车

