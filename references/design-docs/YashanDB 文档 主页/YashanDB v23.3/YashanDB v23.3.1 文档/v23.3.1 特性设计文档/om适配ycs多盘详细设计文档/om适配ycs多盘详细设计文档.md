Created by 瞿蓝孟, last modified on 七月 04, 2024

  


##   [1. 总述](#1-总述)  

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081)    *?#YASHAN-305 YCS支持多盘，支持YFS管理YCS数据*

SR链接：    [https://pingcode.yasdb.com/pjm/items/6611a8ba579a3edb84d860f9](https://pingcode.yasdb.com/pjm/items/6611a8ba579a3edb84d860f9)    ?#YDBRD-25871 YCS支持多盘——OM

ycs支持多盘对现有集群的部署流程有较大的变动，om去适配多盘带来的影响。

详见概要设计文档     [https://conf.yasdb.com/pages/viewpage.action?pageId=150604175](https://conf.yasdb.com/pages/viewpage.action?pageId=150604175)  

###   [1.1 需求来源](#11-需求来源)  

集群内部需求

###   [1.2 调研文档](#12-调研文档)  

ycs的设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=150629086](https://conf.yasdb.com/pages/viewpage.action?pageId=150629086)  

yfs的设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=153023052](https://conf.yasdb.com/pages/viewpage.action?pageId=153023052)  

###   [1.3 需求分析](#13-需求分析)  

- 适配ycs/yfs新的部署流程
- 考虑升级流程的影响


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

生成配置命令新增参数--disk-found-path,  --system-data删除删除 --ycr --vote

```
./bin/yasboot package ce gen --disk-found-path /dev/yfs   --system-data /dev/yfs/datadisk
--disk-found-path  yfs磁盘发现目录，用于创建软连接的目录，选填，默认值为/dev/yfs
--system-data 创建系统dg使用的磁盘，必填
--vote 删除
--ycr 删除

```

其他命令参数不变

./bin/yasboot package ce gen --disk-found-path /dev/yfs部署配置文件变动：

```
cluster = "yashandb"
uuid = "6683a6e561c5cf6fb37c03d6115a2d85"
yas_type = "CE"
# 新增
disk-found-path /dev/yfs

[[system]]
    [system.diskgroup]
        au_size = "1M"
        disk_size = ""
        name = "SYSTEM"
        redundancy = "NORMAL"
        yfs_force_create = false

        [[system.diskgroup.failgroup]]
        disk = ["/dev/yfs/datadisk1"]（软连接）- - /dev/data
		name = "dg1"

		[[system.diskgroup.failgroup]]
        disk = ["/dev/yfs/datadisk2"] 

		[[system.diskgroup.failgroup]]
        disk = ["/dev/yfs/datadisk3"] 



[[group]]
  [group.cedisk]
  [group.config]
	...

```

##   [3. 规格与约束](#3-规格与约束)  

主要为ycs和ycs的限制和约束，om没有额外的约束

- 不兼容原来的裸盘模式
- 支持三种冗余度，分别是外部冗余，普通冗余和高冗余。配置一块磁盘，属于外部冗余，建议选择自身可以实提供冗余保护的硬件设备。普通冗余支持配置3块磁盘，高冗余支持配置5块磁盘。其他数量的磁盘不支持
- (VF盘数/2 )+ 1 或者以上的数量的表决盘损坏时，集群启动失败
- 暂时不支持动态增加或者删除表决盘
- 部署时不支持并发


##   [4. 特性](#4-特性)  

####   [4.1 部署流程变更](#41-部署流程变更)  

om的主体部署流程不变，只是ycs/yfs的初始化流程有所变动

#####   [4.1.1 部署前提：](#411-部署前提)  

- 由于yfs磁盘发现功能，部署之前要创建/dev/yfs的默认目录（可以修改），然后在该目录下创建磁阵的软连接。
- 这一步om来做还是部署之前的手动操作待确定？
- 使用dd命令格式化磁盘


```
# /dev/yfs/datadisk为具体data盘目录
dd if=/dev/zero of=/dev/yfs/datadisk bs=1M count=5

```

#####   [4.1.2 新的部署流程：](#412-新的部署流程)  

1. 启动YFS实例（包含磁盘发现）
1. 配置文件yasfs.ini 中新增 YFS_DISKSTRING=xxxx，原有 BOOT_DISK 配置已作废
1. yascs.ini去除YCR_DISK，新增  **VOTING_FILE_NAME**  和  **YCR_FILE_NAME**  ，不配置默认值为**+SYSTEM/ycr、+SYSTEM/voting**
1. 初始化diskgroup
1. system diskgroup也需要相关配置：如：au_size、data盘目录、冗余度external、normal、high固定为1，3，5
1. om内部配置格式：
1. **ps：这里会默认生成到部署的集群名.toml文件中，用户可以手动修改，由于普通diskgroup已经占用了failgroup参数，所以system无法通过命令来修改，只能手动修改配置文件。**
1. 执行命令：
1. 创建voting和 ycr
1. 扩展voting和 ycr大小可配置，默认100M
1. 覆盖voting和 ycr两个文件
1. 执行yfscmd  ll SYSTEM，查看是否已成功创建两个目录
1. ycs创建集群信息
1. -ycsdisk  参数删除
1. 设置ycr心跳参数
1. ycs添加节点信息
1. 关闭yfssrc(kill -9)
1. 执行ycsctl start ycs，以nomount状态启动node0的ycs+yfs+db
1. 建diskgroup
1. 建库


```
yasfs -D $YASCS_HOME 

```

```
  [[system.diskgroup]]
    au_size = "1M"
    disk_size = ""
    name = "SDG0"
    redundancy = "EXTERNAL"
    yfs_force_create = false

    [[group.diskgroup.failgroup]]
      disk = ["/dev/sdd"]
      name = "SDG0_0"


```

```
yfscmd create system diskgroup system ... sdc

```

```
# 由于 voting和 ycr 校验算法有差异，需在创建时指定文件类型 -t
yfscmd touch -t 1 "+SYSTEM/ycr";
yfscmd touch -t 2 "+SYSTEM/voting";

```

```
# 扩展 2 个文件到 100M，目前规划 ycr 和 voting 文件为 100M
yfscmd truncate -q -s 100M "+SYSTEM/ycr";
yfscmd truncate -q -s 100M "+SYSTEM/voting";

```

```
# 创建大小为 100M 的全零文件，注意该命令的 100 与上一步扩展的文件大小 100M 相关，如果后期 ycr 和voting 文件变大了，这里的 count 也得对应调整
dd if=/dev/zero bs=1M count=100 of=./zero.data

# ycs 要求两个文件初始化为 0。
# 用全零文件覆盖 ycs 的两个文件，这样他们就是全 0
# 利用 echo "Y" 免去交互
echo "Y" | yfscmd cp $PWD/zero.data +SYSTEM/ycr

# 覆盖 voting 文件
echo "Y" | yfscmd cp $PWD/zero.data +SYSTEM/voting

# 此时可以删除临时文件
rm ./zero.data


```

```
# 确认文件已创建，且大小为 100M（Size 字段）
yfscmd  ll SYSTEM
Type Time                 Size     Space    Name
FILE 2024-07-02 05:08:58  100.00MB 100.00MB ycr
FILE 2024-07-02 05:08:59  100.00MB 100.00MB voting

```

```
ycsctl create cluster yascluster -clusterid uuid -o

```

```
ycsctl set_ycr NETWORK_HB_TIMEOUT 30
ycsctl set_ycr DISK_HB_KEEP_ALIVE 30

```

```
ycsctl add node yas0 127.0.0.1:3001
ycsctl add node yas1 127.0.0.1:3002
ycsctl add node yas2 127.0.0.1:3003
ycsctl add yasdbinstance yas0.yasdb start_instance.sh stop_instance.sh monitor_instance.sh
ycsctl add yasdbinstance yas1.yasdb start_instance.sh stop_instance.sh monitor_instance.sh
ycsctl add yasdbinstance yas2.yasdb start_instance.sh stop_instance.sh monitor_instance.sh

```

```
yfscmd exec "shutdown abort"

```

```
ycsctl start ycs

```

```
yfscmd create DG0 diskgroup ... sdc

```

```
create database

```

####   [4.2 升级流程变更](#42-升级流程变更)  

尤其是考虑ycs单盘升级到多盘的场景

前置条件：

- 已有一套单裸盘的集群已部署
- 多盘硬件环境已准备好
- ycs提供新版本的全套升级脚本


旧版本升级设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=141587218](https://conf.yasdb.com/pages/viewpage.action?pageId=141587218)  

旧版本升级流程：

1. 创建升级临时目录upgrade_tmp，upgrade_tmp/ycr
1. 执行yac_precheck.sh（ycs提供）
1. 升级前检查，执行precheck的sql语句
1. 执行yac_preupgrade.sh
1. 停止1号实例以外的所有节点（停止db-备份yasdb-data-停止ycs）
1. 执行yac_upgrade.sh
1. 1号实例的db节点进入升级模式，并执行升级sql
1. 退出升级模式
1. 拉起1号实例外所有节点
1. 执行yac_postcheck.sh
1. 清理ycr备份文件


新版本升级需要解决的问题：

1. 什么时候创建磁盘组，是否要先把所有db和ycs进程全部停掉？
1. 启动yasfs进程后，om可以创建磁盘组和voting file
1. 将ycr配置导入多盘，如何导入，这应该时yac升级脚本提供的能力，yac升级脚本什么时候能提供


上述问题都解决了，才能计划升级流程，目前暂时无法设计。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

  
    
    


## Comments:

|  [](null)  ,时间：2024/07/03,与会人：高风朴、马勇、瞿蓝孟、李垠、徐凡博、张茜,会议纪要：,1.只检查/dev/yfs目录是否存在，目录不能为空，是否有权限；,2.冗余度要做相关检查，跟磁盘数据要相等，只能为1，3，5；,3.-clusterid暂时不从master cherry-pick回来；,4.生成配置文件命令（package ce gen）里面去掉VOTE YCR两个参数，增加system-data（供system dg使用）；普通DG跟system DG不能共用相同data盘,5.本SR只考虑部署流程的变动，升级不在这次SR范围内。,6.增加ycr 和 voting的文件大小配置（  **FILE_SIZE**  ），默认为100M，可修改,Posted by qulanmeng at 七月 03, 2024 11:23|
|---|
