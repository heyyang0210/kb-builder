Created by 李垠, last modified on 十一月 08, 2024

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081)    *?*    
  *#YASHAN-305 YCS支持多盘，支持YFS管理YCS数据*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/662f3aedc36a3d30a85fc9d2](https://pingcode.yasdb.com/pjm/items/662f3aedc36a3d30a85fc9d2)    *?*    
  *#YDBRD-26777 YCS支持单盘升级到多盘*

##   [1. 总述](#1-总述)  

本方案的目的是将ycs从裸盘升级到yfs管理的多副本。

###   [1.1 需求来源](#11-需求来源)  

部署形态：共享集群

内部需求，提高集群产品对外竞争力。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

商用的升级路径为23.2升级到23.3.1.100，目前23.3处于开发阶段，且两版本差异巨大尚未启动回合，升级需要多个模块共同完成，所以暂时没有确定的升级目标版本，本方案仅考虑23.3内部升级，即从23.3.0.3版本升级到23.3.0.y版本，这个版本号等多副本SR上车后才能确定。此升级路径，并非正式的升级路径，它的意义仅在于模拟裸盘升级到多副本的场景，加快8月初启动回合的速度，保证930商用版本的升级工作顺利完成。

**版本策略示意图。**

![](https://pingcode.yasdb.com/atlas/files/public/67396ecda1ad9a3311dc9a01/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFRQUVBQUFBQUFBUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUJBQUFBQUFBQUlBQUFBQUFBQUFBQVFBRUFFQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwMDEsImV4cCI6MTc4MjQ0OTgwMX0.Fq8b6t-3yB8xd3s8nZ_jS3zDHkmaeQOKtE6Q2rkdHp8)

如图：8月初从dev拉出分支，回合master，此时启动23.2到23.3升级分析，到9月底，正式发布23.3.1.100版本，同时从dev拉出23.4分支，23.4分支更名为master，原23.2即master，正式更名为23.2。

从图中可以看出，裸盘到多副本的正式升级路径有两条，一条是23.2.x升级到23.3.1.100（直接升级还是链式升级由大的版本策略决定，本方案不予讨论），一条是23.2.x升级到23.4的第一个商用版本，其中第二条路径在930是还没有目标版本，所以不用考虑。本方案仅讨论23.2.x升级到23.3.1.100这条路径。

###   [1.4 数据字典](#14-数据字典)  

无。

###   [1.5 开源依赖](#15-开源依赖)  

无。

##   [2. 接口](#2-接口)  

无。

##   [3. 规格与约束](#3-规格与约束)  

**1) 本次交付的升级路径为23.3版本内部升级路径，即23.3.0.3升级到23.3.0.y。**

**2) 本次交付的升级路径是用于模拟磁裸盘升级到yfs磁盘发现和多副本，加速8月初的回合工作，不是商用的升级路径，属于临时方案。**

**3) 8月初启动dev回合master时，需要om、db、ycs、yfs共同制定升级方案。本方案也会相应调整。**

**4) 本方案仅支持裸盘升级到yfs磁盘发现和多副本。有可能因为其他模块的不兼容导致升级失败，手动规避。**

**5) 支持裸盘升级到一、三、五块盘。**

**6) 支持复用旧版本的ycr、ycs盘。**

##   [4. 特性](#4-特性)  

###   [4.1 升级策略](#41-升级策略)  

下图是升级策略的分析图

![](https://pingcode.yasdb.com/atlas/files/public/67396ecd8970c2af4f521b90/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFRQUVBQUFBQUFBUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUJBQUFBQUFBQUlBQUFBQUFBQUFBQVFBRUFFQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwMDEsImV4cCI6MTc4MjQ0OTgwMX0.Fq8b6t-3yB8xd3s8nZ_jS3zDHkmaeQOKtE6Q2rkdHp8)

**1) 多副本上车后，打个标签（23.3.0.y），作为升级的目标版本，打标签之前的版本就是源版本（23.3.0.3）。**

**2) 8月初启动dev回合master，23.3.0.y需要更名为23.3.1.100，om需要调整对源版本的检测，从检测23.3.0.x调整为23.2.x的某个版本（由版本大的升级策略决定）**

###   [4.2 版本差异分析](#42-版本差异分析)  

本次SR要实现的是其中“多副本”这个差异项的升级。

![](https://pingcode.yasdb.com/atlas/files/public/67396ecda1ad9a3311dc9a02/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFRQUVBQUFBQUFBUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUJBQUFBQUFBQUlBQUFBQUFBQUFBQVFBRUFFQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwMDEsImV4cCI6MTc4MjQ0OTgwMX0.Fq8b6t-3yB8xd3s8nZ_jS3zDHkmaeQOKtE6Q2rkdHp8)

###   [4.3 升级框架](#43-升级框架)  

升级目录与23.2的ycs升级目录相同，作用相同，其中yac_upgrade.sh 需要将create cluster中的-ycsdisk删除，yascs.ini中的YCR_DISK删除。

```
$YASDB_HOME/admin/dbr/upgrade

  |- 23.3.0.y
    |- yac_precheck.sh         # 升级前检查脚本
    |- yac_preupgrade.sh       # 升级前准备的脚本，进行YCR盘备份，生成导入ycr的配置文件
    |- yac_upgrade.sh          # 升级脚本，处理不兼容变更
    |- yac_rollback.sh         # 是否存在备份恢复无法回滚的操作需要专门的脚本来处理？
    |- yac_postcheck.sh        # 升级后检查脚本

```

详见    [https://conf.yasdb.com/pages/viewpage.action?pageId=141582561](https://conf.yasdb.com/pages/viewpage.action?pageId=141582561)  

升级前准备，根据需要准本一、三、五块1G以上，大小相同的磁盘（不可复用原来的ycs、ycr盘），参考下面文档

  [https://doc.yashandb.com/yashandb/23.2/zh/%E5%AE%89%E8%A3%85%E5%92%8C%E5%8D%87%E7%BA%A7/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/%E5%AE%89%E8%A3%85%E5%89%8D%E5%87%86%E5%A4%87/%E7%9B%AE%E5%BD%95%E5%88%92%E5%88%86.html](https://doc.yashandb.com/yashandb/23.2/zh/%E5%AE%89%E8%A3%85%E5%92%8C%E5%8D%87%E7%BA%A7/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/%E5%AE%89%E8%A3%85%E5%89%8D%E5%87%86%E5%A4%87/%E7%9B%AE%E5%BD%95%E5%88%92%E5%88%86.html)  

下面过程由yasboot负责调度，执行命令

```
/bin/yasboot cluster upgrade --cluster yashandb --disk-found-path /dev/yfs --system-data /dev/yfs/ycsdisk1,/dev/yfs/ycsdisk2,/dev/yfs/ycsdisk3

```

**升级过程**

1. 调用yac_precheck.sh执行升级前ycs状态检查
1. 调用yac_preupgrade.sh，导出ycr配置（注意，对于源版本的备份需要在这一步完成）
1. yfs升级，调用yac_upgrade.sh，yasboot传入磁盘信息和发现路径，启动yfs服务， 创建SYSTEM，+SYSTEM/ycr、+SYSTEM/voting
1. 调用yac_upgrade.sh，进行ycs升级（ 将create cluster中的-ycsdisk删除，yascs.ini中的YCR_DISK删除，导入ycr配置，停止yfs服务）
1. 调用yac_postcheck.sh完成升级后状态检查


yfs升级详见yfs的设计文档

  [https://conf.yasdb.com/pages/viewpage.action?pageId=156120564](https://conf.yasdb.com/pages/viewpage.action?pageId=156120564)  

###   [4.4 回滚](#44-回滚)  

方案同23.2

详见

  [https://conf.yasdb.com/pages/viewpage.action?pageId=138571200](https://conf.yasdb.com/pages/viewpage.action?pageId=138571200)  

1.1 需求来源

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

无。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 手工跑一遍升级过程
1. 使用yasboot升级
1. 升级后ycsctl命令行正常使用
1. 磁盘心跳故障
1. 网络故障
1. 损坏1个ycr副本
1. 损坏2个ycr副本
1. 损坏2个ycs副本
1. 手工跑一遍回滚过程
1. 使用yasboot跑一遍回滚过程（回滚后启停正常，故障处理正常）


##   [6.资料设计章节](#6资料设计章节)  

yasboot升级资料需要修改

##   [7.未来规划](#7未来规划)  

1. 切换为商用版本升级路径。


##   [8.工作量评估](#8工作量评估)  

总计：ycs+yfs 1周

  


## Attachments:

## Comments:

|  [](null)  ,ycs多副本升级开发计划:    
  提供联调版本时间：3天    
  yasboot需要的时间：2~3天    
  源版本：23.3.0    
  目标版本：23.3.0.y    
  转测时间：最晚19号,Posted by liyin at 七月 09, 2024 15:25|
|---|
