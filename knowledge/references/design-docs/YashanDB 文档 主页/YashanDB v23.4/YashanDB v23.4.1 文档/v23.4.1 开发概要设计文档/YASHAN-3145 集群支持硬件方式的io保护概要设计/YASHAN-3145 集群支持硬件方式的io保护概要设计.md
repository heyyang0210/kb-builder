 Created by 李垠, last modified on 十一月 14, 2024

  [YASHAN-3145 - 集群支持硬件方式的io保护](https://pingcode.yasdb.com/ship/ideas/66c73e2889f961f3300fba86)  

  [YDBRD-33803 - 集群支持硬件方式的io保护](https://pingcode.yasdb.com/pjm/items/67077928e489dd0868f3c01c)  

##   [1. 总述](#1-总述)  

SCSI-3协议中的持久预留（Persistent Reservations）提供了一种能力，它可以控制节点对共享磁盘的访问。集群中的节点首先向设备注册一个唯一的key，然后由其中的一个节点在设备上执行”预留“，”预留“确立了设备的访问规则，比如：访问独占，在这种规则下，设备允许已注册节点的访问，而拒接未注册节点的访问。当集群中的某个节点发生故障时，由主节点执行”抢占“命令，将故障节点的key从设备删除，这样故障节点对设备的访问就会被拒绝，这是SCSI fence的基本原理。本文旨在使用SCSI 的持久预留实现对数据盘的fence。

###   [1.1 需求来源](#11-需求来源)  

此需求由产品提出，需要支持集群部署形态。

###   [1.2 调研文档](#12-调研文档)  

  [iofence](https://pingcode.yasdb.com/wiki/spaces/YAS/pages/67397f28728206efb92f7d56)  

原型验证代码  [https://git.yasdb.com/liyin/iofdemo.git](https://git.yasdb.com/liyin/iofdemo.git)  

  [预留、抢占与其他命令并发场景调研](https://pingcode.yasdb.com/wiki/spaces/LIYIN/pages/67485944a03b82348604beab)  

  [oracle 集群管理软件GI进程](https://pingcode.yasdb.com/wiki/spaces/LIYIN/pages/674eef8ca03b82348605d299)  

oracle集群管理软件GI进程链接

  [https://pingcode.yasdb.com/wiki/pages/674eef8ca03b82348605d299](https://pingcode.yasdb.com/wiki/pages/674eef8ca03b82348605d299)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|,,,,,yascs功能,,,|ycs启动时向数据盘注册/预留|为了防止残留，key采用固定值，方便清理；key的类型是CodUint64，由node ip地址最后一段+nodeid组成；在启动db前完成注册；选举后开始注册；主节点注册并预留|是|是||
||ycs停止时释放预留/反注册|停止ycs时，在停掉db后，反注册；主节点同时需要释放预留|是|是||
||ycs升主时执行抢占|升主流程中，将原主节点的key从数据盘踢掉，升主节点成为预留持有者|是|是||
||驱逐备节点时踢掉备节点|主节点驱逐备节点时，将备节点的key踢掉，保证此操作在将故障节点db设置为offline前进行|是|是||
||升级|从不支持硬件iofence版本到支持的版本的升级|是    |是||
||扩容|硬件iofence版本扩容|是|是||
|ycsrootagent功能|提供root权限代理|执行预留各种命令，以及其他需要root权限的命令|是|是||
|可维可测|fence查看|提供ycsctl命令，用于查看数据盘fence情况，展示内容为预留的key、持有预留的key，对应的磁盘路径，预留的类型|是|是||
|易用性|安装部署时检查预留支持情况|支持继续安装；不支持提示在脑裂情况下存在写坏数据的风险，不阻止安装；创建集群命令增加一个ycr配置项：enable_hardiofence|是|是||


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|I_T nexus|nexus between a SCSI initiator port and a SCSI target port.本文可以简单理解为一个host与LUN的连接|是||
|预留持有者PR Holder|执行了预留操作的I_T nexus|是||
|抢占|执行抢占命令，将故障节点的key从注册中踢出，使该节点不具备访问LUN的权限|是||


### 1.5 开源依赖

无。

## 2. 接口

无

## 3. 规格与约束

1. 磁阵必须支持SCSI-3协议，且能够正确执行注册、预留、抢占清理等命令；
1. 如果磁阵不支持SCSI-3协议或者不能正确执行注册、预留、抢占清理等命令，集群将不具备硬件iofence保护能力，一旦发生脑裂，存在写坏磁盘的风险；
1. 支持两种预留类型   Exclusive Access, registrants only、Write Exclusive, registrants only
1. 由磁盘IO卡顿导致的ycsrootagent卡顿，从而导致抢占超时，ycs需要不断重试，不设置重试次数，抢占失败不能升主或者驱逐节点，需要人工介入排除磁盘故障
1. ycs启动过程中如果执行预留相关命令失败（包括超时），进程退出，启动失败，不进行重试，需要人工介入排查原因
1. 当enable_hardiofence为yes时，如果停止了ycsrootagent进程，集群会因为无法执行预留相关命令而出现问题。
1. 提供硬件iofence白名单，名单中的磁阵型号是经过验证支持iofence的磁阵，在此名单中的磁阵才支持硬件iofence


## 4. 特性

### 4.1 总体描述

从SCSI协议角度描述，iofence的过程如下：

1、集群中的所有节点向所有数据盘（LUN）注册

2、master节点向所有数据盘（LUN）执行预留

3、如果非master节点故障，由master节点执行抢占，踢出故障节点（将注册的key删除）

4、如果master节点故障，则由升主节点执行抢占，踢出故障master（将注册的key删除）

详见原型验证代码   [https://git.yasdb.com/liyin/iofdemo.git](https://git.yasdb.com/liyin/iofdemo.git)   中readme的描述

### 4.1.2 ycsrootagent进程

应用程序访问裸设备，需要具备root权限，有两种方式可以选择，一个是将进程创建为root用户，一个是通过setcap命令将应用程序赋予CAP_SYS_RAWIO权限

第二种方法有个问题，就是当应用程序被赋予CAP_SYS_RAWIO权限后，会被系统认为是不可靠程序，而从LD_LIBRARY_PATH中移除这个应用的访问权限，在老版本里，安装部署时，需要建一个yasdb.conf来解决这个问题。所以本文不采用第二种方法，采用第一种方法。

(找不到lib库的原因详见   [提权后为什么会找不到libxxx.so](https://pingcode.yasdb.com/wiki/spaces/LIYIN/pages/673e9f33728206efb9332614)  )

通过一个名为ycsrootagent的进程来实现iofence功能，该进程由yascsm拉起和看护，启动为root用户，与yascsm、yascs通过UDS通信。

ycsrootagent提供如下接口：

1、查询iofence信息

2、检测LUN是否具备iofence能力

3、注册/反注册

4、预留/释放

5、清理所有注册/预留信息

6、抢占

注意：为了方便与硬件的问题定界，该进程的日志中需要打印每次下发给LUN的cmd具体内容，以及返回的内容

参看如下

使用工具查看预留情况，执行命令 sudo sg_persist -r -v /dev/yfs/ycsdisk1

显示信息中包含如下内容：

Persistent Reservation In cmd: 5e 01 00 00 00 00 00 20 00 00

#### 4.1.2.1 进程间关系

部署过程中yasboot负责先拉起ycsrootagent，再拉起ycs

![yasrootagent方案一.png](https://pingcode.yasdb.com/atlas/files/public/675161e5a1ad9a3311de4222/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)

yasboot部署流程

1、如果有root权限，yasboot首先用root用户拉起ycsrootagent，然后用yasdb用户拉起yascsm

2、ycsrootagent由yasmonit负责监控

3、yascs启动时，检查是否需要执行硬件iofence，如果需要，则与ycsrootagent建立UDS连接，连接失败，退出启动；否则不需要与ycsrootagent建立连接，不执行硬件iofence

   与浮动IP兼容性设计：只要有root权限，yasboot就拉起ycsrootagent，不论是否支持预留。
    后续如果传入浮动IP参数，YCS默认存在ycsrootagent进程，配置浮动IP时与该进程建立连接

 

4、yasboot提供是否配置开机启动/看护ycsrootagent的可选项，具体如下：

       1、init.ycsroot 脚本中需要写入用户名，这两个脚本由ycs负责提供样例，yasboot 负责调用执行

       2、部署过程中暂停，提示用户是否要安装init.ycsroot 和ycsroot.service，让用户去另一个安装以root身份执安装脚本，执行完成后，回到安装节点，输入Y继续执行部署，不执行脚本则输入N

           安装脚本要做的事如下

          将init.ycsroot 和ycsroot.service放到对应目录，并执行以下两条命令

           systemctl enable ycsroot.service

           systemctl daemon-reload

![yasboot流程.png](https://pingcode.yasdb.com/atlas/files/public/675977b6a1ad9a3311de478d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)

init.ycsroot 和ycsroot.service具体内容：

/etc/systemd/system/ycsroot.service

核心代码如何，负责看护init.ycsroot

[Service]
ExecStart=/bin/bash /etc/init.d/init.ycsroot
Restart=always

/etc/init.d/init.ycsroot 中 看护ycsrootagent是否存在，不存在则拉起



#### 4.1.2.2 ycsrootagent启停流程

1、执行root 用户下执行 ycsctl start ycsrootagent命令拉起ycsrootagent进程

2、可以配置yasmonit看护ycsrootagent

3、ycsrootagent进程hang住的原因，只可能是访问LUN时LUN没有返回，针对这种情况，yascs执行抢占会超时，yascs需要有重试机制，此过程不限制重试次数

    即：ycs只有在踢掉节点后才能进行驱逐和升主，否则不断重试踢掉节点。

4、执行ycsctl stop ycsrootagent命令停止ycsrootagent

![ycsrootagent启动.png](https://pingcode.yasdb.com/atlas/files/public/6759573ba1ad9a3311de474d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)



#### 4.1.2.3 关键接口流程

为了减少yascs与ycsrootagent的交互次数，ycsrootagent的接口要尽量保证成功，内部做重复配置的容错

1、注册

![注册.png](https://pingcode.yasdb.com/atlas/files/public/673daa018970c2af4f53b654/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)

2、预留

![预留.png](https://pingcode.yasdb.com/atlas/files/public/675955c8a1ad9a3311de474a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)

#### 4.1.2.4 预留能力检测

ycsrootagent 提供预留相关命令，供shell脚本调用，用于做各种场景的预留测试。测试脚本支持输入参数，至少包括节点IP、数据盘列表

注意，为了尽量保证此检查流程与后续ycs运行时执行预留命令的流程一致，做“写盘”时，使用direct io，512字节对齐。

如果不支持预留，需要给出风险提示

一般场景测试流程如下

![iofence能力检测流程.png](https://pingcode.yasdb.com/atlas/files/public/673ef824a1ad9a3311de3559/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)

### 4.2 配置参数

ycr增加一个参数，如下：

-enable_hardiofence=yes   当有root权限并且检查结果为支持硬件iofence，执行如下命令，其他情况不执行

```
ycsctl set_ycr enable_hardiofence yes
```



### 4.3 key设计

踢掉节点时，需要知道被踢节点的key，所以key采用固定值，数据类型是CodUint64，由clustterid+nodeid组成。

### 4.4 ycs启动时向数据盘注册、预留

1、从ycr file读取是否执行硬件iofence

2、启动过程中失败需要退出时，需要清理注册、预留

3、主节点尝试预留，如果其他节点已经预留（该预留节点曾经启动过即可，不要求已经启动），则放弃预留，否则执行预留，避免其他正常运行的节点因为被踢掉而不能访问磁盘

4、不要求预留持有者必须是主节点

![启动流程.png](https://pingcode.yasdb.com/atlas/files/public/6759724ba1ad9a3311de4780/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)



### 4.5 驱逐节点

驱逐节点发生在两个场景，一个是备升主，一个是主驱逐备，不论哪种场景，在写clusterBlock之前，都应该保证将待驱逐节点的key从LUN上踢掉

如果驱逐失败，为了保证不写坏磁盘，执行节点需要abort

![抢占.png](https://pingcode.yasdb.com/atlas/files/public/673f068c8970c2af4f53b70d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)

### 

### 4.6 资源监控流程kill db前执行反注册/释放

db监控流程中，存在kill掉db再拉起的流程，为了保证kill掉的db产生的在途IO不会写盘，在kill掉db前，本节点需要被踢掉，在拉起db前，需要执行注册/预留。

![db重启流程.png](https://pingcode.yasdb.com/atlas/files/public/675960f0a1ad9a3311de4758/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)

### 4.7 fence信息展示

命令样式 ycsctl show fence

展示内容

节点号  数据盘访问权限

0                    normal

1                     reject     

### 4.8 yasboot适配

1、执行检查脚本，进行安装前检查，检查失败给出风险提示，但不阻止安装

2、根据检查结果和是否具有root权限调用ycsctl set_ycr enable_hardiofence yes命令

3、拉起/停止ycsrootagent进程

4、安装部署时提示用户执行init.ycsroot和ycsroot.service

5、提供硬件iofence压力测试的能力（调用预留检查脚本，支持输入测试时长，安装部署流程不需要进行压力测试，只执行一遍检查脚本）

## 5.升级

是否有root权限，建议通过命令行输入root密码来确定

从不支持硬件iofence版本升级到支持硬件iofence的版本，升级流程如下

![升级流程.png](https://pingcode.yasdb.com/atlas/files/public/67597620a1ad9a3311de478b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFFQUFBQVFBREVDQUFBQkFBSUFBQUlBQ0FJUUFBQUFBQUlBQUFBQUFCQUFBQWdBQUFnQUFBQUFBQUFBRUFBQUVBQUVFQUFJQUFBQUlBUUFBQUJBQUFBQUFCQUFBa0FBQUFFRUFJQUFBQUFJQUFnQUFBQUFnQUFBQUFCQUFBQUFVVUFEZ0FDZ0FBQUJRQUFBd0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MDcsImV4cCI6MTc4MjQ2NzQwN30.wAGgvC5rkib0gBQEyCRUIAyCyQ79zqTHiVnBLwTwpng)

回滚流程yasboot不需要自动删除ycsroot.service和init.ycsroot，提示用户手动删除

## 6.扩容

扩容节点需要与原节点具有相同权限

如果有root权限，则需要在扩容节点创建ycsroot.service和init.ycsroot

扩容继承原来的iofence策略，从ycr file读取是否支持scsi fence

## 7.工作量评估

总开发工作量：8周

|任务项|子任务|描述|开发工作量评估（不含详细设计和联调）|
|---|---|---|---|
|yascs进程iofence功能|启动、停止、升主、驱逐流程中的iofence操作,|1、启动流程注册、预留,2、停止流程反注册、预留释放,3、驱逐流程fence节点、kill db fence,4、升主流程fence节点,5、fence查看,6、ycr配置参数,7、安装前fence能力检查脚本，yasboot调用|1周|
|ycsrootagent进程|启动、停止、SCSI预留接口、命令行接口|1、启动ycsrootagent,2、停止ycsrootagent,3、创建与yascsm的UDS通信，接收停止消息,4、创建与yascs的UDS通信，接收各种SCSI请求,5、预留浮动IP接口,6、命令行接口|2周|
|yasboot适配|适配创建集群命令、执行SCSI预留能力检查|1、调用ycs提供的脚本，执行安装前预留能力检查，根据检查结果构造新增的两个参数/风险提示,2、适配新的创建集群的参数,3、让用户执行脚本,4、启动ycsrootagent|2周|
|多用户（待定）--如果采用这个方案，需要拆分SR|ycsrootagent、ycsroot.service脚本、init.ycsroot脚本|1、ycsrootagent框架（不包含SCSI具体实现）,2、ycsroot.service脚本、init.ycsroot脚本|1周|
|ycs升级|升级脚本调整|yac_preupgrade.sh增加参数，将新增的一个配置项写入导出脚本|1周|
|yasboot升级|升级流程对ycsroot.service脚本、init.ycsroot脚本的调度，升级检查、数据库升级命令接口变更|1、ycsrootagent进程拉起,2、数据库升级命令增加一个命令参数,3、升级前检查SCSI支持情况|1周|


## 7.未来规划

未来如果要支持增加磁盘，需要考虑scsi协议支持情况。

