Created by 李世铭, last modified by  施新华 on 一月 24, 2024

**测试概要设计基于IR粒度**

**测试概要设计目的：**    
         1）从需求和调研出发梳理测试设计和策略    
         2）给测试详细设计做输入

IR链接：    [YDBRD-23829](https://jira.yasdb.com/browse/YDBRD-23829?src=confmacro)    -  OM支持一键式更换IP  完成

参考;    [YDBRD-23829 OM支持一键式更换IP调研](https://conf.yasdb.com/pages/viewpage.action?pageId=144117363)  

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

      由于网络部署调整、机房搬迁、网络故障等带来主机IP地址和端口号的变更，  当数据库的IP发生变更，OM工具需要支持快速更换IP的能力。    
       支持单机、分布式、集群三种形态。

     新增命令进行IP更换。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1）支持  单机、分布式、集群的IP通过OM一键式修改；

2）单机部署包含：单节点，1主1备部署，1主2备部署；一键式更改IP后业务正常。

3）分布式包含1cn1mn1dn部署，3cn3mn3dn(3-3)部署，一键式修改IP后正常。

4）集群包含1节点，3节点：

   一键式修改CLUSTER_INTERCONNECT，INTER_URL ，LISTEN_ADDR；

   只修改LISTEN_ADDR；

   只修改INTER_URL；

   只修改CLUSTER_INTERCONNECT；

   修改INTER_URL，LISTEN_ADDR。

5）更新IP后检查数据库相关视图显示正确：V$ARCHIVE_DEST/GV$ARCHIVE_DEST/DV$ARCHIVE_DEST, V$ARCHIVE_DEST_STATUS/GV$ARCHIVE_DEST_STATUS/DV$ARCHIVE_DEST_STATUS, V$REPLICATION_STATUS, V$DIN_NODE, V$DIN_LINK, V$NODE, V$CM_NODE_INFO

  `YCS查询命名：yasboot ycs show`  

5）修改后可以改回。

6）ycm连接数据库，数据库修改后通过配置连接新的数据库IP正常。

7）验证OM命令：包括边界值，异常输入。

8）执行备份后修改数据库IP，修改成功后恢复正常。

9）修改IP后进行倒换，重启正常。

10）白名单配置更新。

11）原有的定时巡检，备份任务更改IP正常。

12）OM本身IP修改后正常。

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

**1) 只支持更换IP，不支持换端口。**

**2) 本次只实现单机部署更换IP，分布式和共享集群不支持。**

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

1)  网络部署调整，机房搬迁，网络故障带来主机IP变化；

2）端口范围调整导致需要更改数据库端口。

3）数据库的IP和端口都出现变化。

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

|测试场景|详细描述|备注|
|---|---|---|
|OM命令|1）覆盖参数边界值；,2）参数值输入错误提示信息具备可读性。|  
|
|OM IP修改|一键式修改OM的IP，包括OM，agent|  
|
|单机修改IP|部署：  单节点，1主1备部署，1主2备部署|  
|
|  
|停止cluster，  一键式更改IP后拉起业务正常|  
|
|  
|更改IP后重启后业务正常，主备切换正常。|  
|
|  
|更改IP后回滚正常，回滚后业务正常。|  
|
|  
|更改IP后查询视图：  V$ARCHIVE_DEST，V$ARCHIVE_DEST_STATUS，V$REPLICATION_STATUS|  
|
|分布式修改IP|1cn1mn1dn部署，3cn3mn3dn(3-3)部署|  
|
|  
|停止cluster，  一键式更改IP后拉起业务正常|  
|
|  
|更改IP后重启后业务正常，主备切换正常。|  
|
|  
|故障cn再拉起，业务正常|  
|
|  
|DN，MN主备倒换正常|  
|
|  
|更改IP后可以回滚，回滚后业务正常|  
|
|  
|更改IP后查询视图：  V$ARCHIVE_DEST/DV$ARCHIVE_DEST，V$ARCHIVE_DEST_STATUS/DV$ARCHIVE_DEST_STATUS，V$REPLICATION_STATUS, V$DIN_NODE, V$DIN_LINK, V$NODE, V$CM_NODE_INFO|  
|
|集群修改IP|部署集群包含1节点，3节点|  
|
|  
|一键式修改CLUSTER_INTERCONNECT，INTER_URL ，LISTEN_ADDR。   |  
|
|  
|只修改LISTEN_ADDR。|  
|
|  
|只修改INTER_URL。|  
|
|  
|只修改CLUSTER_INTERCONNECT。|  
|
|  
|修改INTER_URL，LISTEN_ADDR。|  
|
|  
|更改IP后重启后业务正常。|  
|
|  
|更改IP后可以回滚，回滚后业务正常。|  
|
|  
|```
yasboot ycs show查看更改后IP
```|  
|
|白名单|更改IP后，白名单配置修改后功能正常|  
|
|备份恢复|更改IP之前备份，更改IP后执行恢复，覆盖单机，分布式和集群|  
|
|定时任务|更改IP之前设置定时任务：巡检，备份； 更新IP后任务正常。|  
|
|扩容|更改IP后单机，分布式扩容生成的IP为新的网段。|  
|
|YCM|修改数据库IP后，ycm对接正常|需要给出ycm ip修改方法|
|修改先后顺序验证|先修改DB，再修改agent，om|  
|
|  
|先修改agent，再修改DB，om|  
|
|停止进程后更换IP|停止yasom|  
|
|  
|停止yasagent|  
|
|  
|停止部分db进程|  
|
|  
|停止所有db进程|  
|
|  
|停止所有进程(om,yasagent,yasdb)|  
|


  


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

修改IP后考虑  **升级**  场景，可以采用临时版本验证。

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

自动化验证可以先用127.0.0.1然后再替换为容器IP，或者先部署为容器IP修改为127.0.0.1。

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

安全接入后续需要关注。