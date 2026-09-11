Created by 刘美秀 on 六月 07, 2024

  


IR：    [https://pingcode.yasdb.com/ship/ideas/660b7481009f91eb87f2bfd3](https://pingcode.yasdb.com/ship/ideas/660b7481009f91eb87f2bfd3)    ?    
  #YASHAN-1223 Om支持分布式在线滚动升级

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

  


需求概述：yasboot支持分布式小版本（第四位）主备滚动升级

需求来源：  产品化需求

部署形态：分布式

需求场景：在不影响业务的前提下可以对版本进行升级，重点在于无损升级，还需要支持升级失败后能回滚到升级前状态的能力

升级分为离线升级和滚动升级，离线升级已实现，本次功能主要是在23.2上实现滚动升级，且较22.2优化流程提高易用性。

为了尽可能降低对于业务的影响，采样变更进程的方式，停止旧路径进程启动新路径进程。会先升级完备节点后再升级主节点

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

yasboot cluster upgrade 原有参数   --rolling

|功能点细分|目标|
|---|---|
|--rolling滚动升级|无损业务，对版本可用性要求高|
|小版本|校验版本|
|升级失败可回滚|回滚后，升级期间增量业务无损|
|package upgrage优化|和br22.2的滚动升级比较，22.2的以下步骤都已在package upgrage中实现，提高了易用性：,1.终止yasom yasagen,2..packag install 新包,3.托管（除非旧版本是非yasboot 部署的才需要托管）|


  


  


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

- 允许分布式数据库使用。
- 如果只有一个节点，则不适用于滚动升级，会报错退出。
- 两个节点的时候，滚动升级会在最大可用保护模式下进行；多于两个节点，则不会修改保护模式。


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

主要验证业务背景下升级，业务背景和业务都正常

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

升级部分，关注流程的可用性和易用性

关于现有流程，产品建议：

1，跑升级脚本前，检查内存是否也可以做成跑一条脚本    
  2，升级完成后，手动步骤是否也可以加到自动升级脚本里，包含启动守护进程和更新环境变量

|  
|yasdb滚动升级|||
|---|:---:|---|---|
|  
|步骤|当前方案|详细需求|
|升级前|1.获得新版本安装包|与YashanDB技术支持确认当前在用数据库版本是否可直接升级到该新版本|如果是不支持的版本需报错拦截|
|  
|2.手动确认临时目录的权限及空间足够|滚动升级中会安装新版本数据库的目录，请确保升级操作用户拥有创建该目录的权限，且拥有足够的存储空间。|空间不够/权限不够,能否报错拦截|
|  
|3.手动检查SSH服务|检查服务状态systemctl status sshd.service,检查连接状态：$ ssh 用户名@ip -p ssh端口|ssh连接失败需报错拦截|
|  
|4.手动检查数据库实例状态|yasboot sql -d sys/password@ip:port -s 'select status from v$instance;'|yasboot 内部检查|
|  
|5.手动检查monitor进程|kill -9 monit|yasboot 内部处理？|
|  
|6.全量checkpoint|ALTER SYSTEM CHECKPOINT;|影响升级速度，若没有执行checkoint时升级会等待直到主备同步后再升级|
|升级中|1.执行全量备份|backup database|  
|
|  
|2.上传新版本安装包|  
|  
|
|  
|3.升级OM |在新版本包路径下执行yasboot package upgrade  -t 旧hosts.toml文件 -p 升级包的绝对路径|升级前后怎么确认当前yasom版本？若旧hosts.toml文件未保存？相对路径能拦截|
|  
|4.升级数据库|在新版本包路径下执行yasboot cluster upgrade --cluster yashandb --rolling|  
|
|  
|升级成功后需要手动拉起monit|  
|yasboot 内部拉起|
|  
|5.升级后环境变量配置|  
|只是停掉旧版本的yasom/yasagent/yasdb，然后在新版本路径下拉起这几个进程|
|升级失败|升级回退|./bin/yasboot cluster rollback -c yashandb --rolling|  
|
|  
|  
|./bin/yasboot package rollback -c yashandb -t /home/yashan/install/hosts.toml|  
|


业务部分，关注稳定性和可靠性

|类型|测试项|备注|
|---|---|---|
|流程验证|参考上表|  
|
|节点验证|1、2、3节点、1/3/32 DN组，8CN|  
|
|部署验证|部署为分布式|  
|
|  
|path中不带版本号|  
|
|配置验证|升级前后，关键配置项参数一致，已改动的配置不会被恢复成默认值|不影响|
|业务校验|升级期间无业务流量，升级前后数据一致，条目不变|不影响|
|  
|升级期间，DML，业务不会报错，期间数据一直一致，不会出现账不平|  
|
|  
|sys用户密码变更后，不影响升级|  
|
|  
|业务背景包括：DDL：create/alter/drop/truncate，dml:insert/update/delete/，dql:select，dcl:grant/rollback，shotdown|  
|
|HA验证|升级期间，有增量业务，升级完成后备机能自动同步，主备一致|  
|
|不同保护模式时升级|最大保护、最大性能、最大可用|  
|
|交互验证|升级时扩缩容、导数、备份、恢复备份、cluster/node/group启动、导数|  
|
|  
|扩容后升级|  
|
|升级失败|部分节点成功时，在没有回滚时拉起节点执行业务，会有什么影响？|  
|


  


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

|类型|测试项|
|---|---|
|可靠性|覆盖各种故障时升级失败后，可回滚，回滚前后业务无损|
|  
|正在升级的节点故障、升级备节点时主节点故障、升级主节点时已升级的节点故障|
|  
|手动switchover|
|并发|不同业务并发量下升级，较大流量下升级|
|性能|业务空闲期升级耗时--用时记录|
|  
|业务流量下，升级对于业务的影响：不升级时跑TPCH 和升级时跑TPCH时时延对比|


  


##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

|测试项|自动化看护|框架|
|---|---|---|
|功能|是|install_test|
|业务|是|  
|
|DFX|是|  
|
|性能|否|  
|


  


##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

重点关注业务背景下，主备数据的一致性、事务的一致性

  
