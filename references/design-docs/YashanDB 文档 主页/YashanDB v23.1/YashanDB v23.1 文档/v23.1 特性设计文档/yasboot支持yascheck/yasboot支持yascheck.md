Created by 未知用户 (yanglishan), last modified on 五月 12, 2023



-   [1 需求简介](#yasboot支持yascheck-1需求简介)  
    -   [1.1 需求背景](#yasboot支持yascheck-1.1需求背景)  
    -   [1.2 需求分析](#yasboot支持yascheck-1.2需求分析)  
-   [2 概要设计](#yasboot支持yascheck-2概要设计)  
    -   [2.1 use case 梳理](#yasboot支持yascheck-2.1usecase梳理)  
    -   [2.2 需求实现约束](#yasboot支持yascheck-2.2需求实现约束)  
-   [3 详细设计](#yasboot支持yascheck-3详细设计)  
    -   [3.1 方案整体架构图](#yasboot支持yascheck-3.1方案整体架构图)  
    -   [3.2 接口设计](#yasboot支持yascheck-3.2接口设计)  
    -   [3.3 yascheck的检查项设计](#yasboot支持yascheck-3.3yascheck的检查项设计)  
        -   [系统参数检测：sys param模块](#yasboot支持yascheck-系统参数检测：sysparam模块)  
        -   [服务检测：service模块](#yasboot支持yascheck-服务检测：service模块)  
        -   [进程消耗：process consumption模块](#yasboot支持yascheck-进程消耗：processconsumption模块)  
        -   [自选模块：](#yasboot支持yascheck-自选模块：)  
        -   [磁盘IO测试，默认不开启](#yasboot支持yascheck-磁盘IO测试，默认不开启)  
        -   [网络带宽测试，默认不开启](#yasboot支持yascheck-网络带宽测试，默认不开启)  
        -   [获取数据免密](#yasboot支持yascheck-获取数据免密)  
    -   [3.4 yascheck检查配置设计](#yasboot支持yascheck-3.4yascheck检查配置设计)  
        -   [3.4.1 hosts.toml文件](#yasboot支持yascheck-3.4.1hosts.toml文件)  
        -   [3.4.2 yascheck结果集](#yasboot支持yascheck-3.4.2yascheck结果集)  
            -   [yascheck检查结果的json文件命名格式为 yascheck-host0001-20230412164512.json，参考：https://conf.yasdb.com/display/~yanglishan/yascheck-ip-index.json](#yasboot支持yascheck-yascheck检查结果的json文件命名格式为yascheck-host0001-20230412164512.json，参考：https://conf.yasdb.com/display/~yanglishan/yascheck-ip-index.json)  
    -   [3.5 功能实现流程图](#yasboot支持yascheck-3.5功能实现流程图)  
        -   [yascheck序列图](#yasboot支持yascheck-yascheck序列图)  
        -   [3.5.1 生成hosts.toml配置文件](#yasboot支持yascheck-3.5.1生成hosts.toml配置文件)  
        -   [3.5.2 执行yascheck](#yasboot支持yascheck-3.5.2执行yascheck)  
        -   [3.5.3 使用ssh执行yascheck](#yasboot支持yascheck-3.5.3使用ssh执行yascheck)  
        -   [3.5.4 agent执行yascheck](#yasboot支持yascheck-3.5.4agent执行yascheck)  
-   [4 易用性设计](#yasboot支持yascheck-4易用性设计)  
-   [5 可测试性设计](#yasboot支持yascheck-5可测试性设计)  




# 1 需求简介

## 1.1 需求背景

目前yasboot主机安装和数据库部署前的主机检查功能不够完善，需要支持检查主机内包括进程，硬件，服务等基本信息。同时也需要对检查模块和详细的检查项进行统计得出主机目前的健康得分。

**yascheck的定义**  ：yascheck 是ycm目前已有的系统性的主机检查工具，检查内容，cpu，网络等产品运行的健康状态，  运行后收集系统配置信息，同时按照预定义的规则，评估配置是否符合用户或者数据库的最佳实践。

**yascheck的目的**  ：评估结果输出为一份html格式的健康检查报告，报告中会有所有检查项的细节数据，以及根据规则给被检查系统的一个综合评分。虽然这个评分规则比较“简单粗暴”，（所有检查项的权重都一样），使用这份报告能够使用户更直观的感受到主机的运行状况。

## 1.2 需求分析

- **参考现有yasboot的客户端命令，增加对yasboot的一级命令**
- **原有的host info信息仅支持检查少量的检查项，现替换掉该功能，使用yascheck对主机进行检查。**


```
Usages: yasboot [<flags>] <command>

yasdb bootstrap & operation, version: Debug 22.2.0.9-5354-gc8d4045429

Flags:
  -h,--help  Show detailed help information.

Commands:
  package  package commands
  cluster  cluster commands
  node     node commands
  group    group commands
  task     task commands
  host     host commands
  sql      yasql commands
  process  process commands
  monit    monit commands
  load     load data to yasdb
  check    check the info in the host

Run 'yasboot COMMAND --help' for more information on a command.
```

# 2 概要设计

## 2.1 use case 梳理

1）主机环境信息收集

- 收集目标主机的详细信息，包括系统参数，文件，进程等信息
- 支持本机，指定hosts.toml和agent收集


2）yascheck配置信息修改

- 针对yascheck的详细检查项，可以进行修改是否需要某个检查项进行检查


3）持久化检查结果

- 支持生成yascheck的检查结果文件，以json形式保存


4）生成参数检查配置文件

- 用户可以带配置文件执行yascheck，可以屏蔽检查某些参数


## 2.2 需求实现约束

仍然保留需要root权限的参数  ，但是若无root权限则忽略该参数检查  （或者提示该参数permission denied）

不依赖hosts.toml文件执行，但是若提供hosts.toml，则优先toml文件执行

主机检查支持单主机检查（指定hostid），也支持全部agent检查。

检查规格结果获取？保留原有的计分规则，直接输出包含计分结果在内的详细信息。

所有主机共用一个配置文件。

暂不支持额外指定检查某些参数。

  


# 3 详细设计

## 3.1 方案整体架构图

![](https://pingcode.yasdb.com/atlas/files/public/67396ad38970c2af4f51ff80/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFCQUFBQUJBQUFBQkFBQUFKQ0FBQUFBQUFRQUFBQUFBQUJBQUFFRUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUNCUUFBQUlBQUFBQVFRQUFJQWd3UUJBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMwMjgsImV4cCI6MTc4MjIyMzgyOH0.tnuT0I6RjdNhmQe7n2mw_r2q5oiUNEN9vQ-o-w_mDFU)

整体的架构如上图，主要新增部分如下：

- 在yasboot中新增    `check`    命令，用于下发yascheck主机检查的指令
- 整个om的internal中，新增yascheck模块，该模块用于收集yascheck的各项信息
- 在yasom的model中，数据库新增yascheck模块，用于存储yascheck的检查结果文件信息


## 3.2 接口设计

一级命令如下

```
yasboot check
```

package 命令新增package check gen，生成yascheck的配置文件

同时原有的新增hosts.toml配置文件也支持yascheck配置生成

  


二级命令

|二级命令|三级命令|参数|短参|说明|必须|
|:---:|:---:|:---:|:---:|:---:|:---:|
|collect|  
|--cluster|-c|集群名称|否|
|  
|  
|-  -toml|-t|yascheck.toml配置文件|否|
|  
|  
|--hostid|  
|主机id|否|
|  
|  
|--ssh|  
|使用hosts.toml内的主机进行ssh连接|否，若指定该参数，则hosts.toml为必须参数|
|  
|  
|--format|-f|输出报告的形式，（html,json）|否|
|  
|  
|--output|-o|输出的报告目标地址|否|
|  
|  
|--filename|-n|输出的文件标识|否，不指定默认为时间戳|


（1）本机执行yascheck的信息收集

```
#执行主机检查
yasboot check collect

#执行主机检查生成文件
yasboot check collect -f html -o ~/check/
```

（2）使用toml文件执行检查

```
yasboot check collect -t hosts.toml -f html
```

  


（3）使用hosts.toml里面的主机ssh执行

```
#此为使用了hosts.toml内的host和yascheck配置信息
yasboot check collect -t hosts.toml --host

#筛选主机
yasboot check collect -t hosts.toml --host --hostid host0001
```

  


（4）使用agent连接进行检查

```
yasboot check collect -c multidb

#指定某个主机进行检查
yasboot check collect -c multidb --hostid host0001

#指定某个主机并且指定检查项
yasboot check collect -c multidb --hostid host0001 -t yascheck.toml
```

  


  


## 3.3 yascheck的检查项设计

检查内容命令参考原有的yascheck检查命令

评判没个检查项的规则可以参考：    [yascheck 工具需求内容 - 杨德柳 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=59632660)  

现有  计分规则  逻辑：满分100分

普通，警告，严重设定一个权重比例

损失得分 = 普通 * 普通权重 + 警告* 警告权重 + 严重 * 严重权重

健康得分 = 100 - 损失得分

**硬件信息检测：hardware模块**

|检查项|详细检查内容|权限级别|默认开启检查|命令（参考）|获取方式|
|:---:|:---:|:---:|:---:|---|---|
|CPU    
    
    
    
|名称|普通|是|cat /proc/cpuinfo | grep name | sort -u | awk -F : '{print $2}'|  
|
||架构|普通|是|uname -m|  
|
||物理CPU核数|普通|是|cat /proc/cpuinfo | grep 'physical id' | sort | uniq | wc -l|命令|
||逻辑CPU核数|普通|是|cat /proc/cpuinfo | grep processor | wc -l|命令|
||每个cpu包含的核心数量|普通|是|cat /proc/cpuinfo | grep 'cpu cores' | uniq | awk -F : '{print $2}',kylin：,lscpu | grep 'Core(s) per socket' | uniq | awk -F : '{print $2}'|命令|
||总核心数|普通|是|  
|  
|
|Mem|内存信息|普通|是|free|  
|
|Disk|磁盘信息|普通|是|df | grep -v 'tmpfs'|  
|
|Network    
    
    
|网关信息|普通|是|ip route | grep default | awk '{print $3}'|命令|
||dns信息|普通|是|grep nameserver /etc/resolv.conf| grep -v '#' | awk '{print $2}' | tr '\n' ';' | sed 's/;$//'|命令|
||网卡信息|普通|是|ip -f inet addr | grep -v 127.0.0.1 |  grep inet | awk '{print $NF,$2}' | tr '\n' ';' | sed 's/;$//'|  
|
||网络状态|普通|是|ping     [www.baidu.com](http://www.baidu.com)     -c 3|命令|


### 系统参数检测：sys param模块

|检查项|检查内容|权限级别|默认开启检查|命令|获取方式|
|:---:|:---:|:---:|:---:|---|---|
|os|操作系统名称|普通|是|uname -o|非命令|
|release|操作系统版本|普通|是|cat /etc/redhat-release,awk -F= '/^PRETTY_NAME/{print $2}' /etc/os-release |sed 's/\"//g'|非命令|
|kernel|操作系统架构|普通|是|uname -r|非命令|
|hostname|主机名|普通|是|uname -n|非命令|
|Selinux|安全增强服务|普通|是|sestatus | grep 'SELinux status: ' | awk '{print $3}'|  
|
|磁盘io调度策略|  
|普通|是|cat /sys/block/sda/queue/scheduler | awk -F [ '{print $2}' | awk -F ] '{print $1}'|  
|
|language|字符集类型|普通|是|echo $LANG|  
|
|time|获取时间|普通|是|echo $(date +'  %F     %T  ')|  
|
|last boot time|开机时间|普通|是|who -b | awk '{print $3,$4}'|  
|
|ulimit（系统限制值）|查询用户是否存在|普通|是|su -   %s   -c "ulimit -a" | sed  's/(/:/g' | sed  's/)/:/g' | awk -F: '{print $1":"$3}'|不检查|
||获取某用户的系统限制|普通|是||不检查|
|sysctl|sysctl各个参数|root|是|sysctl -a | grep vm | grep 'swappiness\|dirty_ratio\|dirty_background_ratio\|dirty_expire_centisecs\|vfs_cache_pressure\|min_free_kbytes\|overcommit_memory\|overcommit_ratio\|max_map_count'|  
|
|users    
    
|拥有用户id为0权限的用户|普通|是|for user in $(cat /etc/passwd | awk -F: '{print $1}'); do    
              if [ $(id -u $user) -eq 0 ]; then    
                  echo $user    
              fi    
          done|  
|
||查询sudo用户|root|是|grep -v "^#" /etc/sudoers | grep -v "^Defaults" | sed '/^$/d' | awk '{print $1}' | uniq | tr '\n' ' '|  
|
||查询需要密码登录的用户|普通|是|for shell in $(grep -v "/sbin/nologin" /etc/shells); do    
              for username in $(grep "$shell" /etc/passwd | awk -F: '{print $1}'); do     
              cat /etc/passwd | grep -w "$username" | grep -w "$shell" | awk -F: '{print $1,$3,$4,$6,$7}'    
              done    
          done|  
|


### 服务检测：service模块

|检查项|检查内容|权限|默认开启检查|  
|
|:---:|:---:|:---:|:---:|---|
|sys service|系统开机自启的服务|普通|是|systemctl list-unit-files --type=service --state=enabled --no-pager | grep "enabled" | awk '{print $1}'|
||运行的服务|普通|是|systemctl list-units --type=service --state=running --no-pager | grep ".service" | awk '{print $1}'|
|sshinfo    
    
    
    
|ssh是否设置开机自启|普通|是|systemctl list-unit-files --type=service --state=enabled --no-pager | grep "enabled" | awk '{print $1}'| grep sshd|
||ssh是否开启状态|普通|是|systemctl is-active sshd|
||检查ssh配置文件|普通|是|/etc/ssh/sshd_config|
||ssh协议|root|是|cat /etc/ssh/sshd_config | grep Protocol | awk '{print $2}'|
||允许使用root账户登录|root|是|cat /etc/ssh/sshd_config | grep PermitRootLogin | awk 'NR==1|
|firewalld    
    
|防火墙状态|普通|是|systemctl is-active firewalld|
||是否开机自启|普通|是|同检查sshd是否开机自启|
||防火墙开放的端口|普通|是|firewall-cmd --zone=public --list-ports|
|listeninginfo|监听端口的服务信息|普通|是|ss -tlun|


### 进程消耗：process consumption模块

|检查项|检查内容|权限|说明|命令|
|:---:|:---:|:---:|:---:|---|
|process|cpu消耗top10|普通|是|ps aux | awk '{print $2, $1, $3, $4, $5, $6, $10, $11}' | sort -k3rn | head -n 10|
||内存消耗top10|普通|是|ps aux | awk '{print $2, $1, $3, $4, $5, $6, $10, $11}' | sort -k4rn | head -n 10|


### 自选模块：

### 磁盘IO测试，默认不开启

磁盘io测试需要用到fio工具，若目标主机无此工具，则测试将默认会集成该工具到数据库工具中

### 网络带宽测试，默认不开启

网络测试需要用到  iperf工具  ，若目标主机无此工具，则测试将默认会集成该工具到数据库工具中

### 获取数据免密

部分模块的部分检查项需要sudo权限。以下情况支持直接获取sudo权限的结果

- root账户
- sudo免密


针对sudo需要密码的情况，直接报错。

在获取数据前执行一次以下命令，判断是否具有sudo免密的权限

```
sudo -v
```

## 3.4 yascheck检查  配置设计

### 3.4.1 hosts.toml文件

现将yascheck的配置集成到hosts.toml中，取名为yascheck模块

完全版

```
[yascheck]
  [yascheck.hardware]
    [yascheck.hardware.cpu]
      ignore = false
      physical = "cat /proc/cpuinfo | grep 'physical id' | sort | uniq | wc -l"
      logical = "cat /proc/cpuinfo | grep processor | wc -l"
      cores_per_cpu = "cat /proc/cpuinfo | grep 'cpu cores' | uniq | awk -F : '{print $2}'"
    [yascheck.hardware.memory]
      ignore = false
    [yascheck.hardware.disk]
      ignore = false
    [yascheck.hardware.network]
      ignore = false
      dns = "grep nameserver /etc/resolv.conf| grep -v '#' | awk '{print $2}' | tr '\\n' ';' | sed 's/;$//'"
      gateway = "ip route | grep default | awk '{print $3}'"
      status = "ping 127.0.0.1 -c 3"
  [yascheck.system_params]
    [yascheck.system_params.base_info]
      ignore = false
      selinux = "sestatus | grep 'SELinux status: ' | awk '{print $3}'"
      io_schedule = "cat /sys/block/sda/queue/scheduler | awk -F [ '{print $2}' | awk -F ] '{print $1}'"
      en_lang = "echo $LANG"
    [yascheck.system_params.sysctl]
      sysctl = "sysctl -a | grep vm | grep 'swappiness\\|dirty_ratio\\|dirty_background_ratio\\|dirty_expire_centisecs\\|vfs_cache_pressure\\|min_free_kbytes\\|overcommit_memory\\|overcommit_ratio\\|max_map_count'"
      ignore = false
    [yascheck.system_params.users]
      ignore = false
      user_privilege = "\n        for user in $(cat /etc/passwd | awk -F: '{print $1}'); do\n            if [ $(id -u $user) -eq 0 ]; then\n                echo $user\n            fi\n        done"
      sudo_users = "grep -v \"^#\" /etc/sudoers | grep -v \"^Defaults\" | sed '/^$/d' | awk '{print $1}' | uniq | tr '\\n' ' '"
      need_login_users = "\n        for shell in $(grep -v \"/sbin/nologin\" /etc/shells); do\n            for username in $(grep \"$shell\" /etc/passwd | awk -F: '{print $1}'); do \n            cat /etc/passwd | grep -w \"$username\" | grep -w \"$shell\" | awk -F: '{print $1,$3,$4,$6,$7}'\n            done\n        done"
  [yascheck.service]
    [yascheck.service.sys_service]
      ignore = false
      enabled_service = "systemctl list-unit-files --type=service --state=enabled --no-pager | grep \"enabled\" | awk '{print $1}'"
      running_service = "systemctl list-units --type=service --state=running --no-pager | grep \".service\" | awk '{print $1}'"
    [yascheck.service.ssh_info]
      ignore = false
      enabled = "systemctl list-unit-files --type=service --state=enabled --no-pager | grep \"enabled\" | awk '{print $1}'| grep sshd"
      Status = "systemctl is-active sshd"
      config_path = "/etc/ssh/sshd_config"
      protocol = "cat /etc/ssh/sshd_config | grep Protocol | awk '{print $2}'"
      permit_root_login = "cat /etc/ssh/sshd_config | grep PermitRootLogin | awk 'NR==1'"
    [yascheck.service.firewalld]
      ignore = false
      status = "ufw status | grep Status | awk -F ':' '{print$2}' | grep inactive"
      enabled = "ufw"
      open_ports = "ufw status | grep -v Status | grep ALLOW | awk '{print$1}' | sort -u"
    [yascheck.service.listening_info]
      ignore = false
      listening_service = "ss -tlun"
  [yascheck.process_consumption]
    ignore = false
    cpu_top10 = "ps aux | awk '{print $2, $1, $3, $4, $5, $6, $10, $11}' | sort -k3rn | head -n 10"
    mem_top10 = "ps aux | awk '{print $2, $1, $3, $4, $5, $6, $10, $11}' | sort -k4rn | head -n 10"
  [yascheck.network_io]
    ignore = true
    [yascheck.network_io.server]
      kill_server = false
      cmd = "iperf=/home/yang/gowork/src/anchorbase/install/ext/iperf;$iperf -s -p 9999 -D"
    [yascheck.network_io.client]
      cmd = "iperf=/home/yang/gowork/src/anchorbase/install/ext/iperf;$iperf -c 127.0.0.1 -p 9999 -i 1 -d -t 10"
  [yascheck.disk_io]
    ignore = true
    cmd = "fio=/home/yang/gowork/src/anchorbase/install/ext/fio/bin/fio;$fio --randrepeat=1 --ioengine=sync --direct=1 --gtod_reduce=1 --name=test --directory=./ --bs=4k --size=4G --readwrite=randrw --rwmixread=75 --runtime=10s --output-format=json"

```

  


### 3.4.2 yascheck结果集

- #### yascheck检查结果的json文件命名格式为 yascheck-host0001-20230412164512.json，参考：
- summary文件，即汇总文件：


[yascheck-local-1683547800.json](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDNhMWFkOWEzMzExZGM3ZGY1IiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.kNNfG-igPs8UPZcO0q0OanPDsd2nySUHuaSyXZj2Dck)

[summary.json](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDM4OTcwYzJhZjRmNTFmZjdmIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.YpyWqOOgV7JOBW_qHInchgY1YwckHcBvAzJr8x1zAuw)

检查结果html：

## 3.5 功能实现流程图

### yascheck序列图

![](https://pingcode.yasdb.com/atlas/files/public/67396ad3a1ad9a3311dc7df8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFCQUFBQUJBQUFBQkFBQUFKQ0FBQUFBQUFRQUFBQUFBQUJBQUFFRUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUNCUUFBQUlBQUFBQVFRQUFJQWd3UUJBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMwMjgsImV4cCI6MTc4MjIyMzgyOH0.tnuT0I6RjdNhmQe7n2mw_r2q5oiUNEN9vQ-o-w_mDFU)

  


### 3.5.1 生成hosts.toml配置文件

![](https://pingcode.yasdb.com/atlas/files/public/67396ad4a1ad9a3311dc7df9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFCQUFBQUJBQUFBQkFBQUFKQ0FBQUFBQUFRQUFBQUFBQUJBQUFFRUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUNCUUFBQUlBQUFBQVFRQUFJQWd3UUJBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMwMjgsImV4cCI6MTc4MjIyMzgyOH0.tnuT0I6RjdNhmQe7n2mw_r2q5oiUNEN9vQ-o-w_mDFU)

### 3.5.2 执行yascheck

本机执行yascheck，删除存入数据库模块，仅只接生成。

![](https://pingcode.yasdb.com/atlas/files/public/67396ad48970c2af4f51ff81/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFCQUFBQUJBQUFBQkFBQUFKQ0FBQUFBQUFRQUFBQUFBQUJBQUFFRUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUNCUUFBQUlBQUFBQVFRQUFJQWd3UUJBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMwMjgsImV4cCI6MTc4MjIyMzgyOH0.tnuT0I6RjdNhmQe7n2mw_r2q5oiUNEN9vQ-o-w_mDFU)

### 3.5.3 使用ssh执行yascheck

![](https://pingcode.yasdb.com/atlas/files/public/67396ad48970c2af4f51ff82/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFCQUFBQUJBQUFBQkFBQUFKQ0FBQUFBQUFRQUFBQUFBQUJBQUFFRUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUNCUUFBQUlBQUFBQVFRQUFJQWd3UUJBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMwMjgsImV4cCI6MTc4MjIyMzgyOH0.tnuT0I6RjdNhmQe7n2mw_r2q5oiUNEN9vQ-o-w_mDFU)

### 3.5.4 agent执行yascheck

![](https://pingcode.yasdb.com/atlas/files/public/67396ad4a1ad9a3311dc7dfa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFCQUFBQUJBQUFBQkFBQUFKQ0FBQUFBQUFRQUFBQUFBQUJBQUFFRUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUNCUUFBQUlBQUFBQVFRQUFJQWd3UUJBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMwMjgsImV4cCI6MTc4MjIyMzgyOH0.tnuT0I6RjdNhmQe7n2mw_r2q5oiUNEN9vQ-o-w_mDFU)

# 4 易用性设计

  


# 5 可测试性设计

## Attachments:

[image2023-4-13_17-11-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDI4OTcwYzJhZjRmNTFmZjczIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.D-9trYEuWkGPpkvjqEmROCu0g126TmQlzGIdDuc467A)

 (image/png)    


[image2023-4-13_17-12-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDI4OTcwYzJhZjRmNTFmZjc0IiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.Koc1vLPJcvOosEAz5GsRES4_WmxIROZ-ojz6JV2COmg)

 (image/png)    


[yascheck序列图.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDJhMWFkOWEzMzExZGM3ZGVjIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.0_tw5C4a3XIYIk7pEndvbmIQbFFhZx86XRE7MKIqp3c)

 (image/png)    


[image2023-4-13_17-15-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDJhMWFkOWEzMzExZGM3ZGVkIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.T_I7d4Z_r-skpBKurCoctaycbBRWwVryzT5dgkaOUw8)

 (image/png)    


[image2023-4-13_17-16-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDI4OTcwYzJhZjRmNTFmZjc1IiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.KxbRxaqc7MeH9Teob6s6DNAIpHV3LtnwWbezBSQNFH4)

 (image/png)    


[image2023-4-13_17-51-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDJhMWFkOWEzMzExZGM3ZGVlIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.32uLUDbgcJUhlCQ3FkN1EMTsOpitGYt4IA6Mj7nq9sY)

 (image/png)    


[image2023-4-13_17-59-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDNhMWFkOWEzMzExZGM3ZGVmIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.1p2wKKe2Hk7C7zE36oNHzqlK1-1ox_yWTZOUDLhioFk)

 (image/png)    


[image2023-4-13_18-4-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDM4OTcwYzJhZjRmNTFmZjc2IiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.z-v4ByKfVy6sVTG0QMkzjIVfAFQK9EOJy3OnIw4-yYM)

 (image/png)    


[image2023-4-13_20-10-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDM4OTcwYzJhZjRmNTFmZjc3IiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.fIB5cFbMHDI5reZbTfltKfAG4RXUn-Hi37QOZV0DVSs)

 (image/png)    


[image2023-4-13_20-12-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDM4OTcwYzJhZjRmNTFmZjc4IiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.DAjruWLF3W4dQAOBco9YK7uJ-cIhOymq3EEWLNhLUQE)

 (image/png)    


 (text/html)    


[image2023-4-15_14-50-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDNhMWFkOWEzMzExZGM3ZGYwIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.3df4H_CsIGt6Tdy-89P-SRAJ0heGqMvXDOX_E0uvhF0)

 (image/png)    


[image2023-4-15_16-3-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDM4OTcwYzJhZjRmNTFmZjdhIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.nD_cA7_pJbMyUkYd1QtaitxzP-PMsd5WFOUaaGfnbTk)

 (image/png)    


[image2023-4-15_16-40-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDNhMWFkOWEzMzExZGM3ZGYyIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.eahIfy_R-7OLRpfXv06FQ-RP3EXPZ-mxNPWukkJac5g)

 (image/png)    


[image2023-4-15_16-41-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDNhMWFkOWEzMzExZGM3ZGYzIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.tIgCQIXjVuo_qJ4DRiLr1dNt87NUS_aGc9LWjjucZU4)

 (image/png)    


[image2023-4-15_16-41-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDM4OTcwYzJhZjRmNTFmZjdiIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.1WzWW0p6_JyXPvAIuOafu8DvXHkVygkSSruWnPWrZZY)

 (image/png)    


[image2023-4-15_17-7-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDNhMWFkOWEzMzExZGM3ZGY0IiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.4RR_lSVe_p1JhPB0XIj2aL93GX09rtC4_JywKecDXqI)

 (image/png)    


[image2023-4-15_17-37-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDM4OTcwYzJhZjRmNTFmZjdkIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.3U0VU-1NlsltLXnupdD0lddxFcZBr_ksxd2pKTNZU7Y)

 (image/png)    


[yascheck-local-1683547800.json](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDNhMWFkOWEzMzExZGM3ZGY1IiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.kNNfG-igPs8UPZcO0q0OanPDsd2nySUHuaSyXZj2Dck)

 (application/json)    


[summary.json](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDM4OTcwYzJhZjRmNTFmZjdmIiwicmVmX2lkIjoiNjczOTZhZDI1OTNmOTljOWZmMjM1YTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDI4LCJleHAiOjE3ODIyOTk0Mjh9.YpyWqOOgV7JOBW_qHInchgY1YwckHcBvAzJr8x1zAuw)

 (application/json)    


## Comments:

|  [](null)  ,1、yasboot，agent，yascheck关系图,2、yascheck定义，解释，具备哪些能力,3、检查流程图，配置文件,Posted by yanglishan at 四月 14, 2023 11:30|
|---|
|  [](null)  ,4.14日初步评审会议纪要：    [yascheck初步评审会议纪要](/pages/createpage.action?spaceKey=YASDOC&title=yascheck%E5%88%9D%E6%AD%A5%E8%AF%84%E5%AE%A1%E4%BC%9A%E8%AE%AE%E7%BA%AA%E8%A6%81)  ,Posted by yanglishan at 四月 14, 2023 14:33|
