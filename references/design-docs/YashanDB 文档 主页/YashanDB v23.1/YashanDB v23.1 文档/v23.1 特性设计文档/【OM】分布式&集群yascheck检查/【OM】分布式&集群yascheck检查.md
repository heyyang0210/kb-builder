Created by 朱松平, last modified on 八月 07, 2023

#   [分布式&集群yascheck检查](#分布式集群yascheck检查)  

SR链接：

  [https://jira.yasdb.com/browse/YDBRD-13323](https://jira.yasdb.com/browse/YDBRD-13323)  

  [https://jira.yasdb.com/browse/YDBRD-13324](https://jira.yasdb.com/browse/YDBRD-13324)  

##   [1. Overview（概述）](#1-overview概述)  

说明本设计方案的需求来源，需求分析，功能概要描述。参照已有商业数据库开发的特性，原则上必须有特性调研文档。

在yascheck中，新增部分检查参数适配分布式的资源规格。使用命令和评分规则和现有yascheck相同，该文档只是新增一些分布式环境下的检查项。

分布式的操作系统参数要求：    [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E8%BF%90%E7%BB%B4%E6%89%8B%E5%86%8C/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/%E5%AE%89%E8%A3%85%E5%89%8D%E5%87%86%E5%A4%87/%E6%93%8D%E4%BD%9C%E7%B3%BB%E7%BB%9F%E5%8F%82%E6%95%B0%E8%B0%83%E6%95%B4.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E8%BF%90%E7%BB%B4%E6%89%8B%E5%86%8C/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/%E5%AE%89%E8%A3%85%E5%89%8D%E5%87%86%E5%A4%87/%E6%93%8D%E4%BD%9C%E7%B3%BB%E7%BB%9F%E5%8F%82%E6%95%B0%E8%B0%83%E6%95%B4.html)  

集群没有新增检查项，已有功能可以检查磁盘的大小、磁盘io信息。

其中YCR_DISK，DATA_DISK和VOTING_DISK权限，以及是否相同；yascs/yasfs inter connect URL是否可以连通性，在yasboot package ce gen命令中已经有检查；这些参数与部署的参数密切相关，不集成在yascheck中。

yaschack设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=107381679](https://conf.yasdb.com/pages/viewpage.action?pageId=107381679)  

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 分布式](#21-分布式)  

新增检查项

|模块|检查项|评分标准|备注|
|---|---|---|---|
|system_params.sysctl|vm.swappiness|value > 0，评分级别为  **warn**  ，value > 90，CRITICAL|分布式要求，关闭交换区，  vm.swappiness=0|
||net.ipv4.ip_local_port_range|<= 30000，评分级别为  **warn**|分布式要求，下限值建议大于30000|
||vm.max_map_count|<= 2000000，评分级别为  **warn**|分布式要求，建议大于2000000|
|system_params.ulimit|core file size|||
||data seg size|||
||file size|||
||pending signals|||
||max locked memory|||
||max memory size|不为unlimited，评分级别为  **warn**|分布式要求，unlimited|
||open files|小于65536，评分级别为  **info**  ;小于1024，评分级别为  **warn**|分布式要求，最小65536|
||pipe size|||
||POSIX message queues|||
||real-time priority|||
||stack size|< 8192，评分级别为  **warn**|分布式要求，最小8192|
||cpu time|||
||max user processes|< 65536，评分级别为  **warn**|分布式要求，最小65536|
||virtual memory|||
||file locks|||


###   [2.2 集群](#22-集群)  

涉及的检查项

- 磁盘大小


|模块|检查项|评分标准|备注|
|---|---|---|---|
|yascheck.hardware.disk|Device||设备名称，新增字段|
||Filesystem||文件系统|
||Size||磁盘大小|
||Used||已经使用的大小|
||Available||可使用大小|
||UsedPercent||使用率|
||MountedOn||挂载目录|


示例：

```
"Disk": [
           {
                "Device": "/dev/sdd1",
                "Filesystem": "ext2/ext3",
                "Size": "19.56G",
                "Used": "44.07M",
                "Available": {
                    "Value": "18.52G",
                    "Level": "SAFE"
                },
                "UsedPercent": "0.23%",
                "MountedOn": "/data/sdd"
            }
        ],

```

- 磁盘IO


通过修改配置文件中    `yascheck.disk_io`    的cmd参数，配置测试io的磁盘路径等参数

```
  [yascheck.disk_io]
    ignore = true
    cmd = "$fio --randrepeat=1 --ioengine=sync --direct=1 --gtod_reduce=1 --name=test --directory=./ --bs=4k --size=4G --readwrite=randrw --rwmixread=75 --runtime=10s --output-format=json"

```

##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

**没有新增接口以及修改现有接口**

参考：    [https://conf.yasdb.com/pages/viewpage.action?pageId=107381679](https://conf.yasdb.com/pages/viewpage.action?pageId=107381679)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

- 只会对已经挂载的磁盘进行检查


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [](#)  

####   [5.1 默认 yascheck.toml调整](#51-默认-yaschecktoml调整)  

默认的检查项配置文件改动如下：

- 新增    `ulimit`    的检查模块
- 现有检查模块    `system_params.sysctl`    修改
- yascheck.toml


```
[yascheck.system_params.ulimit]
      user_limit = "ulimit -a | sed  's/(/:/g' | sed  's/)/:/g' | awk -F: '{print $1\":\"$3}'"
      ignore = false

```

```
[yascheck.system_params.sysctl]
      sysctl = "/usr/sbin/sysctl -a | grep 'vm\\|ipv4' | grep 'swappiness\\|dirty_ratio\\|dirty_background_ratio\\|dirty_expire_centisecs\\|vfs_cache_pressure\\|min_free_kbytes\\|overcommit_memory\\|overcommit_ratio\\|max_map_count\\|ip_local_port_range'"

```

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
      gateway = "/usr/sbin/ip route | grep default | awk '{print $3}'"
      status = "ping 127.0.0.1 -c 3"
  [yascheck.system_params]
    [yascheck.system_params.base_info]
      ignore = false
      selinux = "/usr/sbin/sestatus | grep 'SELinux status: ' | awk '{print $3}'"
      io_schedule = "cat /sys/block/sda/queue/scheduler | awk -F [ '{print $2}' | awk -F ] '{print $1}'"
      en_lang = "echo $LANG"
    [yascheck.system_params.sysctl]
      sysctl = "/usr/sbin/sysctl -a | grep 'vm\\|ipv4' | grep 'swappiness\\|dirty_ratio\\|dirty_background_ratio\\|dirty_expire_centisecs\\|vfs_cache_pressure\\|min_free_kbytes\\|overcommit_memory\\|overcommit_ratio\\|max_map_count\\|ip_local_port_range'"
      ignore = false
    [yascheck.system_params.ulimit]
      user_limit = "ulimit -a | sed  's/(/:/g' | sed  's/)/:/g' | awk -F: '{print $1\":\"$3}'"
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
      status = "systemctl is-active firewalld"
      enabled = "systemctl list-unit-files --type=service --state=enabled --no-pager | grep \"enabled\" | awk '{print $1}'| grep firewalld"
      open_ports = "firewall-cmd --zone=public --list-ports"
    [yascheck.service.listening_info]
      ignore = false
      listening_service = "/usr/sbin/ss -tlun"
  [yascheck.process_consumption]
    ignore = false
    cpu_top10 = "ps aux | awk '{print $2, $1, $3, $4, $5, $6, $10, $11}' | sort -k3rn | head -n 10"
    mem_top10 = "ps aux | awk '{print $2, $1, $3, $4, $5, $6, $10, $11}' | sort -k4rn | head -n 10"
  [yascheck.network_io]
    ignore = true
    [yascheck.network_io.server]
      kill_server = false
      cmd = "$iperf -s -p 9999 -D"
    [yascheck.network_io.client]
      cmd = "$iperf -c 127.0.0.1 -p 9999 -i 1 -d -t 10"
  [yascheck.disk_io]
    ignore = true
    cmd = "$fio --randrepeat=1 --ioengine=sync --direct=1 --gtod_reduce=1 --name=test --directory=./ --bs=4k --size=4G --readwrite=randrw --rwmixread=75 --runtime=10s --output-format=json"

```

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

###   [5.2.1 整体流程](#521-整体流程)  

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](#54-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](#55-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

###   [5.6 参考资料](#56-参考资料)  

  [https://www.cnblogs.com/liugp/p/12014222.html](https://www.cnblogs.com/liugp/p/12014222.html)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*