Created by 施新华, last modified on 八月 22, 2024

# 1. 概述

OM支持部分节点开启选举在：在自动切换部署下，支持设置只切换特定备机。比如主+ABC备库，只设置AB备库进行选举和切换，C库只参与同步，但是在关闭自动切换后支持手动switchover。

需求来源：数研所需求，客户需要在北京部署一个3节点raft主备，然后在苏州部署3个备库，北京的主库异步发送redo给苏州的备库，但是苏州的备库不参与自动选举，不参与quorum接收redo。

# 2. 需求分析

  [https://pingcode.yasdb.com/pjm/items/668e6050288e197820b9947e](https://pingcode.yasdb.com/pjm/items/668e6050288e197820b9947e)    ?    
  #YDBRD-30226 OM支持部分节点开启自选主

需求规格：

  


- 部署时，一组主备节点，可以只对部分节点开启自选举。（部署时，toml指定不参与选举的节点）
- 开启自选主的节点，在设置ARCHIVE_DEST_x的时候，对于未开启选举的备库，要这设置特殊标志，以便数据库识别这些备库，不参与选举投票。
- 支持开关部分节点自选主的指令（指令参数是一组DN，指令执行时，按照自选主顺序开关这组DN的选举开关）
- 升级流程需要适配，因为自选主只在部分节点启用


  


设计文档参考：    [om支持部分节点自选主](163000896.html)  

两地节点关系如下，目标部署状态：实例 1、2、3、4为同一主备集群， 节点5和6 为备机4的级联备；此时需要配置北京节点1、2、3作为自选主的范围。

![](https://conf.yasdb.com/download/attachments/159428833/%E9%83%A8%E5%88%86%E8%8A%82%E7%82%B9%E8%87%AA%E9%80%89%E4%B8%BB.drawio.png?version=2&modificationDate=1721025772000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIwMDEsImV4cCI6MTc4MjM4MjgwMX0.XlB0ymndFC9jwKP7jMAl4ClGBMFy3e2WVtDJ90T-d04)

OM需要完成部署，指定group开关自选，主备切换以及升级适配。

## 2.1 功能点分析

### 2.1.1 部署

**1）生成部署配置命令新增参数:**    
    --group    
   --standby-node

```
./bin/yasboot package se gen -c yashandb --node 3 --group 2 --standby-node 3 
 --group, --standby-node  不能与--cascade-parent，cascade-node同时使用
 --group                  默认为1，最大为2，第二个group全为备节点，除去1号节点外，其他为级联备，group2 不参与自选主
 --standby-node           控制备group里面的节点数量，不指定默认跟node保持一致，group为1或不填写时，指定该参数无效
```

**2）部署toml文件变化如下，生成两个组，其中group2为备节点，默认group2的第一个是group1的备节点，其它是级联备。**

```
cluster = "yashandb"
create_simple_schema = false
uuid = "66ab3227bf48248378abb8789e2d1274"
yas_type = "SE"

[[group]]
  group_type = "db"
  name = "dbg1"
  [group.config]
    CHARACTER_SET = "utf8"
    ISARCHIVELOG = true
    REDO_FILE_NUM = 4
    REDO_FILE_SIZE = "128M"

  [[group.node]]
    data_path = "/home/yashan/anchorbase/work/data/yashandb"
    hostid = "host0001"
    role = 1
    [group.node.config]

  [[group.node]]
    data_path = "/home/yashan/anchorbase/work/data/yashandb"
    hostid = "host0002"
    role = 2
    [group.node.config]
    
  [[group.node]]
    data_path = "/home/yashan/anchorbase/work/data/yashandb"
    hostid = "host0003"
    role = 2
    [group.node.config]
    
[[group]]
  group_type = "db"
  name = "dbg2"
  [group.config]
    CHARACTER_SET = "utf8"
    ISARCHIVELOG = true
    REDO_FILE_NUM = 4
    REDO_FILE_SIZE = "128M"
    
  [[group.node]]
    cascade-parent = true
    data_path = "/home/yashan/anchorbase/work/data/yashandb"
    hostid = "host0004"
    role = 2
    [group.node.config]

  [[group.node]]
    data_path = "/home/yashan/anchorbase/work/data/yashandb"
    hostid = "host0005"
    role = 3
    [group.node.config]
    
  [[group.node]]
    data_path = "/home/yashan/anchorbase/work/data/yashandb"
    hostid = "host0006"
    role = 3 
    [group.node.config]
```

**3）新增命令关闭自选举**

/bin/y  as  boot   group  ** auto_election**   disable -c yashandb --  group  -id   XX

- 只支持单机，分布式
- group-id找不到报错
-   `OM下发SQL：ALTER SYSTEM SET HA_ELECTION_ENABLED=TRUE/FASLE,scope=both;`  
- 关闭自选开关：先备后主
- 开启自选开关：先主后备


**4）部署完成后yasdb.ini中变化**

```
# group 1
节点1：HA_ELECTION_ENABLED=TRUE，           
ARCHIVE_DEST_1=SERVICE=192.168.6.155:1689 NODE_ID=1-2:2
ARCHIVE_DEST_2=SERVICE=192.168.6.153:1691 NODE_ID=1-3:3
ARCHIVE_DEST_5=SERVICE=192.168.6.155:1693 NODE_ID=2-1:4 DISABLE_ELECTION=TRUE VALID_FOR=PRIMARY_ROLE


节点2：HA_ELECTION_ENABLED=TRUE，
ARCHIVE_DEST_1=SERVICE=192.168.6.153:1689 NODE_ID=1-1:1
ARCHIVE_DEST_2=SERVICE=192.168.6.153:1691 NODE_ID=1-3:3
ARCHIVE_DEST_5=SERVICE=192.168.6.155:1693 NODE_ID=2-1:4 DISABLE_ELECTION=TRUE VALID_FOR=PRIMARY_ROLE


节点3：HA_ELECTION_ENABLED=TRUE，           
ARCHIVE_DEST_1=SERVICE=192.168.6.153:1689 NODE_ID=1-1:1
ARCHIVE_DEST_2=SERVICE=192.168.6.155:1689 NODE_ID=1-2:2   
ARCHIVE_DEST_5=SERVICE=192.168.6.155:1693 NODE_ID=2-1:4 DISABLE_ELECTION=TRUE VALID_FOR=PRIMARY_ROLE


# group 2
节点4：HA_ELECTION_ENABLED=FALSE，           
ARCHIVE_DEST_1=SERVICE=192.168.6.153:1695 NODE_ID=2-2:5 VALID_FOR=ALL_ROLES
ARCHIVE_DEST_2=SERVICE=192.168.6.155:1695 NODE_ID=2-3:6 VALID_FOR=ALL_ROLES
ARCHIVE_DEST_3=SERVICE=192.168.6.153:1689 NODE_ID=1-1:1 DISABLE_ELECTION=TRUE VALID_FOR=PRIMARY_ROLE

节点5：HA_ELECTION_ENABLED=FALSE，         
ARCHIVE_DEST_1=SERVICE=192.168.6.155:1693 NODE_ID=2-1:4 VALID_FOR=PRIMARY_ROLE
ARCHIVE_DEST_2=SERVICE=192.168.6.155:1695 NODE_ID=2-3:6 VALID_FOR=PRIMARY_ROLE
ARCHIVE_DEST_3=SERVICE=192.168.6.153:1689 NODE_ID=1-1:1 DISABLE_ELECTION=TRUE VALID_FOR=PRIMARY_ROLE

节点6：HA_ELECTION_ENABLED=FALSE，         
ARCHIVE_DEST_1=SERVICE=192.168.6.155:1693 NODE_ID=2-1:4 VALID_FOR=PRIMARY_ROLE
ARCHIVE_DEST_2=SERVICE=192.168.6.153:1695 NODE_ID=2-2:5 VALID_FOR=PRIMARY_ROLE
ARCHIVE_DEST_3=SERVICE=192.168.6.153:1689 NODE_ID=1-1:1 DISABLE_ELECTION=TRUE VALID_FOR=PRIMARY_ROLE
```

### 2.1.2 升级

升级命令无变化，内部逻辑处理。

## 2.2 应用场景

集群内部署多个节点，只有部分节点参与选举，其它节点只同步数据。

## 2.3 约束

- 只有单机支持。
- 配置项中，不参与选举的所有节点都必须保持一致。
- 本节点不参与自选举，HA_ELECTION_ENABLED 必须设置为FALSE，否则连接到主库后会断连。
- 本节点不参与自选举，不参与quorum的个数，不可设置为quorum的备库
- 不考虑一主一备多级联备仲裁的情况。
- 2个group的节点数量相加不能超过33。


# 3. 详细测试设计

## 3.1 测试设计方法

参数检查——边界值，等价类

功能验证——场景组合

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|是|


**生成配置参数检查**

|对象|参数|测试项|测试描述|结果|
|---|:---|:---|:---|---|
|yasboot package se gen    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|--group|默认值|1|pass|
|||取值范围|有效范围：1,2,无效值：0,3,100|pass,min se group is 1, but group 0 you given,max se group is 2, but group 100 you given|
||--standby-node    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|默认值|与--node参数一致，最小值是2|pass|
|||取值范围|有效范围：[2,31],无效值：33,34|the max count of standby nodes and nodes is 33, but 34 you given|
|||--group为1，参数值配置|无论输入多少不生效|pass|
|||--group为2，参数值配置    
    
    
    
    
    
    
    
    
    
    
    
    
|输入0，报错|目前未报错，与node个数相同|
||||不填值，默认与--node参数一致|pass|
||||standby-node个数 + node个数 >33 , 报错|pass|
||||node=2， standby-node=31|pass|
||||node=31，standby-node=2|pass|
||||node=1， standby-node=32|min nodes of group is 2, but 1 you given|
||||node=32， standby-node=1|min standby nodes of group is 2, but 1 you given|
||||node=0， standby-node=33|min db nodes is 1, but 0 you given|
||||node=33， standby-node=0|the max count of standby nodes and nodes is 33, but 66 you given|
|||与参数--cascade-parent同时输入|报错|--group and --cascade param can't be used at the same time|
|||与参数--cascade-node同时输入|报错|--group and --cascade param can't be used at the same time|
|||与参数--cascade-parent，--cascade-node同时输入|报错|--group and --cascade param can't be used at the same time|
|yasboot package config gen    
    
|--group|默认值|1， 指定参数无异常|未适配|
||--standby-node|默认值|与–db一致， 指定参数无异常|未适配|
|yasboot group   auto_election    
    
    
    
|on|  
|打开自选开关|pass|
||off|  
|关闭自选开关|pass|
||非法参数|test11|报错|pass|
||--  group  -id|取值范围|1,2|pass|
|||无效值|0,3|pass|
|||集群部署下执行|报错|未拦截|
|||分布式部署执行|报错|未拦截|


**场景组合**

|测试项|测试场景|测试详细描述|预期|
|:---|:---|:---|:---|
|部署卸载    
    
    
    
    
    
    
    
    
    
    
    
    
    
|group=2部署    
    
    
    
    
    
    
    
    
    
    
|node=1， standby-node=32|部署成功，卸载成功；  node 最小值是2|
|||node=2， standby-node=31|部署成功，卸载成功|
|||node=3， standby-node=30|部署成功，卸载成功|
|||node=32，standby-node=1|部署成功，卸载成功；  standby-node最小值2|
|||node=31，standby-node=2|部署成功，卸载成功；|
|||node=30，standby-node=3|部署成功，卸载成功|
|||node=1，node=1|部署成功，卸载成功；  最小值是2|
|||node=2，node=2|部署成功，卸载成功|
|||node=2，node=2，分别指定group开启OM自选|部署成功，开启OM仲裁报错，  目前未拦截|
|||node=3，node=3，观察节点配置文件|1.部署成功，卸载成功,2. 观察ini配置文件|
||group=1部署    
    
|部署1个节点，然后卸载|部署成功，卸载成功|
|||部署3个节点，然后卸载|部署成功，卸载成功|
|||部署33节点，然后下载|部署成功，卸载成功|
|倒换    
    
    
    
    
    
    
    
    
|node=2,standby-node=2部署    
    
    
    
|group2第一个节点执行switchover|倒换成功|
|||group2非第一个节点执行switchover|倒换失败|
|||group2第一个节点倒换后，group1节点再次倒换|倒换成功|
|||group2第一个节点倒换后，group2其它节点再次倒换|倒换成功|
|||group2非第一个节点为主，group1节点倒换|source_node 为主节点， 可以倒换|
|||group1内节点故障，group2内第一个节点执行failover|执行成功|
|||group1内节点故障，group2内非第一个节点执行failover|执行失败|
|||group2第一个节点故障，group2内其它节点执行failover|执行成功；  找不到source_node节点可以执行failover|
||node=3,standby-node=3部署    
    
    
    
|group1内主节点故障|选举出新主在group1|
|||group1内备执行switchover|执行成功|
|||group2第一个节点执行switchover|执行成功；   报错|
|||group1组内故障2个节点|无新主选出|
|||group1组内故障2个节点，group2内节点执行failover|group2第一个节点执行成功，其它节点执行失败|
|||group2内节点全部故障|不影响group1节点业务|
|||设置group2第一个节点优先级最高：    
  alter system set HA_ELECTION_PRIORITY= 100;    
  group1主节点开启自动切换：    
  alter system set HA_ELECTION_AUTO_PRIMARY_SWITCH = true|group2第一个节点不会升主|
|关闭/打开自选    
    
    
|node=3,standby-node=3部署|指定--group-id 1 开启自选|配置成功，观察节点yasdb.ini文件，先主后备开启；业务不受影响|
|||指定--group-id 1 关闭自选|配置成功，观察节点yasdb.ini文件，先备后主关闭；业务不受影响|
|||group1开启自选，主故障|group1内选举新主|
|||group1关闭自选，主故障|无主|
|||group1自选开启，group2自选开启|group2开启成功，观察节点状态；   group2拦截|
|||group1自选开启，group2自选关闭|group2关闭成功，观察节点状态；   group2拦截|
|||group1自选关闭，group2自选开启|group2开启成功，观察节点状态；  group2拦截|
|||group1自选关闭，group2自选关闭|group2关闭成功，观察节点状态；   group2拦截|
||node=30,standby-node=3部署|group1内自选关闭|执行正常|
|||group1内自选打开|执行正常|
||node=2,standby-node=3部署|group1内自选打开，主故障|无主|
|||group1内自选打开，备执行switchover|倒换成功|
|备份恢复    
    
|node=3,standby-node=3部署    
    
|通过yasrman执行备份，指定goup1内主节点|备份成功|
|||通过yasrman执行备份，指定goup1内备节点|备份成功|
|||通过yasrman执行备份，指定goup2内备节点|备份成功；第一个备节点备份成功，其它备节点报错|
|||通过yasrman执行恢复，指定goup1内主节点|恢复成功|
|||通过yasrman执行恢复，指定goup1内备节点|恢复成功|
|||通过yasrman执行恢复，指定goup2内备节点|恢复成功，  但是其它节点build失败|
|||通过yasbak进行备份，指定role为primary|备份成功|
|||通过yasbak进行备份，指定role为standby|备份成功|
|||通过yasbak进行备份，指定group1内节点地址|备份成功|
|||通过yasbak进行备份，指定group2内节点地址|备份成功，  group2内非第一个节点备份失败|
|||reset集群后，指定group1节点备份集进行恢复，同时恢复备节点|恢复成功，不会丢失数据|
|||reset集群后，指定group2节点备份集进行恢复，同时恢复备节点|恢复失败|
|扩缩容(  版本拦截  )    
    
    
    
|扩容group1内节点|扩容group1备节点2个|扩容成功|
|||扩容group1备节点到最大|group1内节点最大数 = 33 - group2节点数   未实现|
||缩容group1内节点|删除group1内部分节点|缩容成功|
|||删除group1内节点到最小1个|缩容成功；最大保护模式下需要保留2个节点|
|||删除group1内节点到最小1个，然后再扩容2个|扩容成功，选举正常|
||删除group1|group remove指定删除group 1|删除失败 ； db not support to remove|
||扩容group2内节点|扩容2个节点|扩容成功    扩容失败|
|||扩容到最大节点数|group2内节点最大数 = 33 - group1节点数    扩容失败|
||缩容group2内节点|删除group2内非第一个节点|删除成功     提示成功，实际未删除|
|||删除group2内第一个节点|删除失败；   提示成功，实际未删除|
||删除group2|group remove指定删除group 2|删除失败；  db not support to remove|
||并发扩容|group1和group2组内节点并发扩容|报错|
|升级|node=3,standby-node=3部署|执行升级|升级成功|
|||升级失败|回滚成功|


  


# 4. 测试用例

  


# 5. 测试框架设计

dp_ha_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.6.153|20G|200G|SSD|6核|centos7.0|
|192.168.3.156|20G|200G|SSD|6核|centos7.0|


# 7. 工作量评估

工作量：2  *人天*

计划测试完成时间：8/21

## Comments:

|  [](null)  ,评审纪要,参与人：瞿蓝孟，张旭涛，施新华,纪要：,1）package config gen后续不在继续新增命令，使用package /se/de/ce  gen 取代,2）  yasboot group   auto_election下发自选开关，group1和group2都可以执行成功，节点状态可能出错,3）group1和group2扩缩容并发，报错；实际还是按照一个组内处理,Posted by shixinhua at 八月 19, 2024 11:47|
|---|
