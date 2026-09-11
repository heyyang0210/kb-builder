# 1. 概述

1、需求来源：产品化需求

2、需求概述：

  [(3774) 【YDBRD-33803】硬件iofence能力--测试设计 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6768bac9a03b8234860bd023)  

共享集群基于硬件能力进行I/O Fencing是可选且推荐的配置项，但硬件（共享存储或服务器）是否支持以及支持何种硬件Fencing能力难以手动检测。

本需求使用YCSRA命令行，并基于命令行实现SCSI I/O fencing能力检测脚本，便于安装部署和集群升级等场景的自动化配置。

# 2. 需求分析

  [(3775) 知识管理 - PingCode (yasdb.com)   --开发设计文档](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6790919fd06ac74ecc3f9528)  

根据功能支持自动检测配置最优值的特点，主要涉及安装部署自动检测、以及升级场景的自动检测配置。

因此测试场景需要涵盖：

1)、安装部署时需要检测硬件是否支持SCSI协议服务（不支持时安装部署给出风险提示交互安装），支持则该值安装部署时给检测支持的最优值。 该需求保证。

2)、需要考虑升级、和简单的扩容场景。   **--升级SR保证**

  [https://pingcode.yasdb.com/pjm/items/6760e678622069d46df91c1d?](https://pingcode.yasdb.com/pjm/items/6760e678622069d46df91c1d?)  

#YDBRD-36625 集群支持升级到支持硬件iofence的版本

集群：4节点集群、主备集群

## 2.1 功能点分析

新增功能：

|场景| 详情|
|---|---|
|YCSRA新增命令行接口|1. ycsrootagent scsi命令
1. ycsrootagent pingdisk命令
1. 新增命令均需要root权限
|
|fenceScsiCheck.sh脚本|fenceScsiCheck.sh脚本|
|om安装部署|om安装部署|


## 2.2 接口

新增接口：

|接口|接口表现|接口说明|
|---|---|---|
|ycsrootagent scsi {allow|ban|clear}> -d <dev> [-a],|执行scsi fence相关的操作,allow --注册和预留以获得I/O权限,ban  --抢占以剥夺其写权限，故障触发fence时既能体现,clear --清理注册预留，硬件iofence功能是通过mathp多路径清理手动操作的，该需求需要验证该接口|1. 需要root权限
1. 不建议用户手动执行
|
|ycsrootagent pingdisk -s <bytes> -n <count> -d <dev>|读写磁盘|1. 需要root权限
1. 不建议用户手动执行
|
|./fenceScsiCheck.sh -d <devices> -i <ip> -u <user> -p <passwd>|检测设备是否具备scsi I/O fencing能力|1. 需要root权限
|
|错误码|错误码、ACTION描述|----|
|告警|告警描述|----|
|日志|日志触发条件、等级、事件描述|----|




# 3. 详细测试设计

## 3.1 测试设计方法

采用场景法、正交组合法进行详细设计场景。

## 3.2 详细测试设计

### 3.2.1 功能测试

1、新增接口验证

2、脚本验证

3、安装部署

scsi  执行验证顺序，allow-->ban-->clear

|测试项|命令接口|测试场景|负责人|
|---|---|---|---|
|新增接口验证。,安装前接口校验|ycsrootagent scsi  allow -d <dev> [-a],执行后需要在,mpathpersist -i -k 各自节点集群上磁阵查看有注册预留|1、ycsrootagent scsi allow -d 单个华为磁阵，成功,2、ycsrootagent scsi allow -d  入参异常：特殊符号、null、空、整型、超长字符、多值、不存在路径、本地盘、 联想磁阵、多个磁阵,3、执行ban之后，再次执行allow，成功。,第四大点：,      1、机器1 不带-a，机器2不带-a，机器3 带-a，机器4带-a  ，预期：mpathpersist -i -k <dev>  磁阵占用显示为：0x1、0x1、0x2、0x2,      2、机器1 不带-a，机器2带-a。 磁阵占用显示为：0x1、0x1、0x2、0x2（0x1\0x1代表2条多路径）,      3、可以发散组合。,5、机器1多次执行allow、连续使用-a/a，成功 ,组合串行-a和a，报错。|牛亚娜|
||ycsrootagent scsi ban -d <dev> [-a],mpathpersist -i -k 各自节点集群上磁阵查看有注册预留,-a 区分2台主机,|1、ycsrootagent scsi ban -d  单个华为磁阵，成功,2、ycsrootagent scsi ban -d  入参异常：无前置执行、特殊符号、null、空、整型、超长字符、多值、不存在路径、本地盘、 联想磁阵、多个磁阵,3、执行ban的磁阵尚未allow，成功。,4、不执行allow，,      1、机器1 不带-a，机器2不带-a，机器3 带-a，机器4带-a。 ,            预期查看：,            1、mpathpersist -i -k <dev>  磁阵占用显示为：0x2,            2、export YASCS_HOME=/data/jenkins/yasbuild/cluster_home/YASCS_HOME1;yasfs -D /data/jenkins/yasbuild/cluster_home/YASCS_HOME1 &,            yfscmd -D /data/jenkins/yasbuild/cluster_home/YASCS_HOME1 exec "create diskgroup DG0 external redundancy disk '/dev/mapper/zq-1-500G' force  attribute 'au_size'='32M'"    --创建报错不支持磁盘，资料增加错误码说明,因为有占用残留,        2、机器1 不带-a，机器2带-a。,            预期查看：,            1、mpathpersist -i -k <dev>  磁阵占用显示为：0x2,            2、export YASCS_HOME=/data/jenkins/yasbuild/cluster_home/YASCS_HOME1;yasfs -D /data/jenkins/yasbuild/cluster_home/YASCS_HOME1 &,            yfscmd -D /data/jenkins/yasbuild/cluster_home/YASCS_HOME1 exec "create diskgroup DG0 external redundancy disk '/dev/mapper/zq-1-500G' force  attribute 'au_size'='32M'"    --创建报错不支持磁盘，资料增加错误码说明,因为有占用残留,         3、可以发散组合。,5、机器1多次执行ban、连续使用-a/a，成功 ,组合串行-a和a，报错。|牛亚娜|
||ycsrootagent scsi  clear -d <dev> [-a],一把清理所有key。,|一、结合allow测试,1、ycsrootagent scsi allow -d /dev/mapper/LUN01 华为磁阵，mpathpersist -i -k 磁阵 查看有注册预留,3、ycsrootagent scsi clear -d /dev/mapper/LUN01 华为磁阵，mpathpersist -i -k 磁阵 查看无任何占用,4、ycsrootagent scsi allow -d /dev/mapper/LUN01 华为磁阵  --预期正常,二、结合ban测试,1、ycsrootagent scsi allow -d  华为磁阵,2、ycsrootagent scsi ban -d  华为磁阵 ,3、ycsrootagent scsi ban -d  华为磁阵   mpathpersist -i -k 磁阵 ,4、ycsrootagent scsi clear -d 华为磁阵 ，mpathpersist -i -k 磁阵 ,5、ycsrootagent scsi ban -d  华为磁阵   --  预期正常  ，也可能需要从allow开始执行,三、,ycsrootagent scsi clear -d 本地盘 、联想磁阵,ycsrootagent scsi clear -d  入参异常：特殊符号、null、空、整型、超长字符、多值、不存在路径,四、,      一、使用ycsrootagent scsi ban/allow -d:,      1、机器1 不带-a，机器2不带-a，机器3 带-a，机器4带-a  ，预期：mpathpersist -i -k <dev>  磁阵占用显示为：0x1、0x1、0x2、0x2，执行清理命令后再次查看mpathpersist -i -k <dev> 为空,      2、机器1 带-a，机器2不带-a，机器3 带-a，机器4带-a  ，预期：mpathpersist -i -k <dev>  磁阵占用显示查看有，执行清理命令后再次查看mpathpersist -i -k <dev> 为空,      3、自由组合,      二、 mpathpersist/sg_persist，和ycsrootagent同理。主要查看做了清理之后的显示。mpathpersist -i -k <dev> 为空,五、前置，盘被占用（yashan可用ha框架安装部署构造）,使用ycsrootagent scsi clear 清理。（ha框架修改）|牛亚娜、陈俊杰|
||ycsrootagent pingdisk  -d <dev>,ycsrootagent pingdisk -d /yfs/data,接口测试磁盘是否可正常读写。不能影响正常使用中的集群环境|1、 -d 特殊符号、null、空、整型、超长字符、多值、不存在路径、联想,2、 -d 正确入参，不报错。,3、结合 {allow|ban|clear}使用，allow之后pingdisk成功,ban之后pingdisk成功。  --节点1做ban，节点2pingdisk失败,clear之后pingdisk成功,4、节点2断存储网，节点2执行该命令失败,5、正常使用环境过程中，随意下发（脚本后台循环放着），不影响集群、数据完整。|牛亚娜|
|脚本验证,安装前脚本|fenceScsiCheck.sh，检测特定设备是否SCSI设备、是否支持SCSI I/O fencing。,./fenceScsiCheck.sh -d <devices> -i <ip> -u <user> -p <passwd>,参数说明：,-d：指定检测的scsi设备，可指定多个设备，逗号分隔,完整验证需要执行2个机器。|1、-d 指定一个，分别为华为磁阵、联想磁阵、nvme挂载方式的华为磁阵、本地盘，验证接口的准确性,2、-d 指定多个，分别为华为磁阵、联想磁阵、nvme挂载方式的华为磁阵、本地盘,3、-i  - u -p验证：,      设备支持，不指定-i  - u -p不报错（虽然不指定也代表本机，但是指定写了本机执行也会报错）,      设备支持，指定-i  - u -p为本机报错，查看报错信息是否明确 ，-u -p入参错误，不匹配等验证报错，也是和指定正确一样的错，因为走不到校验密码的逻辑。,      设备支持，指定-i  - u -p为远端，成功，-u -p入参错误，不匹配等验证（报错，密码）,      设备不支持，不管是否指定都报错。,4、-d 指定多个支持的磁阵，验证成功。,5、脚本返回信息是否明确、直观。|牛亚娜、陈俊杰|
|安装部署|yasboot安装部署|一、,      1、磁阵支持硬件iofence，yasboot安装之后查看默认值为硬件iofence能力。,      2、安装成功后，修改为软件fence给出风险提示，执行简单的kill ycs场景构造fence场景,      3、再修改为硬件fence能力，执行简单的kill ycs场景构造fence场景,通过ycsctl show fence 可查看。,,![image.png](https://pingcode.yasdb.com/atlas/files/public/67c57d826a1ae92ae3736894/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg1NDEsImV4cCI6MTc4MjQ2OTM0MX0.QQ-qbGiEmxQYzM9fA5k55N0zp_hWKO1sAhJIgFtK9Gw),二、磁阵不支持硬件iofence，yasboot安装之后默认值不为硬件iofence能力。,       1、ycsctl set_ycr fence_type 1,成功，但是启动报错，查看ycs日志是否有不支持的相关字眼。,三、yasboot在不支持的磁阵上安装集群，交互安装，提示风险，是否继续等步骤。支持的磁阵无交互顺利安装（可能需要输入sudo的账户密码的交互）。,四、安全。查看/etc/profile无任何新增变量。,四、yasboot安装部署前，使用接口ycsootagent注册预留，再次安装，报错，需要手动清理   -----别增加自动清理。|牛亚娜|
||安装成功|支持的硬件fence磁阵：,      执行ycsrootagent scsi  allow --报错，执行失败,       ycsrootagent scsi  ban  --报错，执行失败,ycsrootagent scsi  clear    --是否拦截？？不拦截的话是否需要资料说明？？用户保障    （是否增加-f，不加的话不清自己确认，加了忽略直接清理）,不支持同理失败。|陈俊杰|
|资料||产品文档需要体现这些接口，资料验证。|陈俊杰、牛亚娜|
|yasboot框架调整||因为有交互安装，需要增加 -f ,需要和框架确认|牛亚娜|
|执行网络用例|使用yasboot安装支持硬件fence能力的环境，执行部分网络故障用例|使用yasboot安装支持硬件fence能力的主备集群，执行网络故障用例|张茜|


# 4. 测试框架设计

使用ha_regress框架自动化

# 5. 测试环境说明

|服务器|  
|
|:---|:---|
|部署|  
|
|操作系统|Linux|


# **6、工作量评估**

1.5人周