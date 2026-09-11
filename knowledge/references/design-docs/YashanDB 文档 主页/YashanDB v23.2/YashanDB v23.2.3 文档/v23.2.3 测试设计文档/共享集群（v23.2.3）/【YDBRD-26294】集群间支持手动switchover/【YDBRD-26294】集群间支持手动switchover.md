Created by 张彩虹, last modified on 五月 18, 2024

# **1. 概述**

本文描述集群switchover测试设计。

# **2. 需求分析**

在客户场景测试或者演练过程中，需要进行主备之间的倒换演练。需要主备集群支持集群间手动switchover。

## **2.1 功能点分析**

SR链接：    [https://pingcode.yasdb.com/pjm/items/66191dcafd997db58ad89fec](https://pingcode.yasdb.com/pjm/items/66191dcafd997db58ad89fec)    ?    
  #YDBRD-26294 【主备集群】集群间支持手动switchover

概要设计文档：    [概要设计-YASHAN-170 : 集群支持手动Switchover](150626579.html)  

开发方案文档：    [详细设计-YDBRD-26294 : 集群支持Switchover 方案设计](150619173.html)  

### 2.1.1 主备切换能力

执行alter database switchover操作实现

## **2.3 规格约束**

- **备集群**


1. 备集群只能是1号实例执行switchover，并且是处于open阶段。
1. 备集群的所有实例的redo传输必须是正常的（连接正常并且状态也是正常）。
1. switchover期间备集群阻塞其他实例加入集群。（同Failover表现一致）
1. switchover完成之后，如果脏页没有刷完，新主的其他实例也是不可以加入集群的。（同Failover表现一致)


- **主集群**


1. 主集群的1号实例必须open。
1. 其他存活实例的状态必须是open状态，不能出现nomount状态或者是mount状态。
1. 执行switchover期间，新的实例加入集群需要报错。
1. 执行switchover期间，如果有实例退出，switchover失败。
1. 主集群reform(节点退出/加入)期间，执行switchover会失败


# **3. 详细测试设计**

## **3.1 测试设计方法**

该需求测试设计思路主要是场景法，大的测试场景主要分为语法测试、动态视图、业务场景测试、并发场景测试、压力这五个部分。

## **3.2 详细测试设计**

1、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及|
|压力|涉及|
|性能|涉及|
|可维护性|涉及|


2、详细测试点

|编号|测试场景|子场景描述|预期|备注|
|:---|---|:---|:---|:---|
|1|语法测试|备集群1号实例执行  alter database switchover|成功|  
|
|2||备集群非1号实例执行  alter database switchover|报错|  
|
|3||主集群执行  alter database switchover|报错|  
|
|4|动态视图V$DATABASE中  SWITCHOVER_STATUS|* NOT ALLOWED：切换条件不满足  （数据库未open或者断联，备机need repair）    
  * TO STANDBY：数据库已准备好切换到备角色    
  * TO PRIMARY：数据库已准备好切换到主角色    
  * WAIT PRIMARY DEMOTE：正在切换中，等待主库完成降备    
  * PROMOTING：备库正在切换为主库|不同阶段字段值符合预期|  
|
|5|  
    
    
    
    
  业务场景|  
|  
|  
|
|6||主集群的1号实例nomount，其他存活实例open——>备集群1号实例open，执行  switchover|报错|  
|
|7||主集群的1号实例mount，其他存活实例open——>备集群1号实例open，执行  switchover|报错|  
|
|8||主集群的1号实例open，其他存活实例nomount——>备集群1号实例open，执行  switchover|报错|  
|
|9||主集群的1号实例open，其他存活实例mount——>备集群1号实例open，执行  switchover|报错|  
|
|10||主集群的1号实例open，其他存活实例open——>备集群1号实例nomount，执行  switchover|报错|  
|
|11||主集群的1号实例open，其他存活实例open——>备集群1号实例mount，执行  switchover|报错|  
|
|12||主集群1号实例未启动，其他存活实例open——>备集群1号实例open，执行  switchover|报错|  
|
|13||断主集群网卡——>备集群1号实例open，执行  switchover|报错|  
|
|14||杀掉主集群所有实例——>备集群1号实例open，执行  switchover|报错|  
|
|15||杀掉主集群所有实例后做failover——>新备集群1号实例open，执行  switchover|成功|  
|
|16||杀掉主集群所有实例后做failover(备机处于need repair状态)——>新备集群1号实例open，执行switchover++|报错|  
|
|17||主集群的1号实例open，其他存活实例open——>备集群1号实例open，执行  switchover——>新主执行业务正常|成功|  
|
|18||主集群的1号实例open，其他存活实例open——>备集群1号实例open，执行  switchover——>新主执行业务正常——>故障新主后执行failover|成功|  
|
|19||主集群的1号实例open，其他存活实例open——>主集群执行业务并备份——>备集群1号实例open，执行  switchover——>清理备机后使用备份集和在线redo+归档去进行PITR恢复|成功|  
|
|20||循环执行多次  switchover|成功|  
|
|21||switchover时只有两个实例，过程中拉起第三个实例，拉起nomount成功，mount、open报错，退出成功++|  
|  
|
|22||临时表空间的集群HA场景++（需要看其他功能场景是否需要在集群HA环境进行测试）|  
|  
|
|23|  
    
    
  并发场景（CT+KT）|备集群执行  switchover与备集群执行switchover并发（同一个备集群两个客户端并发）|只有一个成功|  
|
|24||备集群执行  switchover与备集群执行switchover并发（两个备集群并发）|报错？|  
|
|25||备集群执行  switchover与主集群执行业务并发  （业务执行中断）——>设置不自动提交，校验未提交事务是否回滚|switchover成功，业务中断|  
|
|26||备集群执行  switchover与备集群执行业务并发  （业务执行中断）——>设置不自动提交，校验未提交事务是否回滚|switchover成功，业务中断|  
|
|27||备集群执行  switchover与备集群加入实例并发  （switchover优先级最高，加入实例卡住）|switchover成功，加入实例卡住|  
|
|28||备集群执行  switchover与备集群退出1号实例并发  （1号实例退出会报错）|报错|  
|
|29||备集群执行  switchover与备集群退出非1号实例并发|两个都成功|  
|
|30||~~备集群执行~~  ~~switchover与主集群加入1号实例并发~~|~~此场景不存在，主集群1号实例必须open才能执行switchover操作~~|  
|
|31||备集群执行  switchover与主集群加入非1号实例并发|  
|  
|
|32||备集群执行  switchover与主集群退出1号实例并发|  
|  
|
|33||备集群执行  switchover与主集群退出非1号实例并发|成功|  
|
|34||备集群执行  switchover与主集群故障（kill 1号实例yasdb）并发  （kill 除1号实例之外的其他两个实例db进程,启动脚本改成open拉起，观测报错）   |报错|  
|
|35||备集群执行  switchover与主集群故障（kill 非1号实例yasdb）并发|成功|  
|
|36||备集群执行  switchover与主集群故障（kill 1号实例yascs）并发|报错|  
|
|37||备集群执行  switchover与主集群故障（kill 非1号实例yascs）并发|成功|  
|
|38||备集群执行  switchover与备集群故障（kill 1号实例yasdb）并发|报错|  
|
|39||备集群执行  switchover与备集群故障（kill 非1号实例yasdb）并发|成功|  
|
|40||备集群执行  switchover与备集群故障（kill 1号实例yascs）并发|报错|  
|
|41||备集群执行  switchover与备集群故障（kill 非1号实例yascs）并发|成功|  
|
|42|压力场景|大数据量下执行  switchover，并观测其执行性能|成功|低优先级|


# **4. **  **测试用例**

冒烟用例

|序号|测试场景|预期|
|---|:---|:---|
|1|主集群的1号实例open，其他存活实例open——>备集群1号实例open，执行  switchover——>新主执行业务正常|成功|
|2|主集群的1号实例open，其他存活实例nomount——>备集群1号实例open，执行  switchover|报错|
|3|主集群的1号实例open，其他存活实例open——>备集群1号实例nomount，执行  switchover|报错|


  


# **5. 测试框架设计**

本次测试使用anchor_regress框架  实现

# **6. 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|集群|


# **7、工作量评估**

总计 11人天

测试设计+评审  2人天

测试 5人天

自动化+调试稳定 3人天

上车分析 1人天

## Comments:

|  [](null)  ,集群支持switchover测试设计评审会议纪要：    
  一、会议时间：2024/05/10  周五 10：00-11：00    
  二、会议地点：腾讯会议    
  三、会议主持人：张彩虹    
  四、参会人员：马志宏、朱国旭、高亚宁、张彩虹    
  五、会议主题：集群支持switchover测试设计评审    
  六、会议总结    
      增加测试场景：    
      1、业务场景：杀掉主集群所有实例后做failover(备机处于need repair状态)——>新备集群1号实例open，执行switchover    
      2、业务场景：switchover时只有两个实例，过程中拉起第三个实例，拉起nomount成功，mount、open报错，退出成功,    3、并发场景（CT+KT）：备集群执行switchover与主集群加入或者退出实例并发,    完善测试场景：,    1、并发场景中主备集群故障的方式由pkill改为kill,精确故障到各个实例    
      2、并发场景中switchover与主集群或者备集群执行业务并发时，设置事务为不自动提交，业务中断后校验未提交事务是否回滚,Posted by zhangcaihong at 五月 11, 2024 10:02|
|---|
