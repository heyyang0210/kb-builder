Created by 李世铭, last modified on 十一月 14, 2023

# **1、概述**

目前yasboot主机安装和数据库部署前的主机检查功能不够完善，需要支持检查主机内包括进程，硬件，服务等基本信息。同时也需要对检查模块和详细的检查项进行统计得出主机目前的健康得分。

**yascheck的定义**  ：yascheck 是ycm目前已有的系统性的主机检查工具，检查内容，cpu，网络等产品运行的健康状态，  运行后收集系统配置信息，同时按照预定义的规则，评估配置是否符合用户或者数据库的最佳实践。

**yascheck的目的**  ：评估结果输出为一份html格式的健康检查报告，报告中会有所有检查项的细节数据，以及根据规则给被检查系统的一个综合评分。虽然这个评分规则比较“简单粗暴”，（所有检查项的权重都一样），使用这份报告能够使用户更直观的感受到主机的运行状况。

**SR：**    [YDBRD-13316](https://jira.yasdb.com/browse/YDBRD-13316?src=confmacro)    **-**  **【OM】使用yascheck进行环境信息收集**  **完成**    [YDBRD-13319](https://jira.yasdb.com/browse/YDBRD-13319?src=confmacro)    **-**  **【OM】yasboot集成yascheck进行配置项修改**  **完成**    [YDBRD-13318](https://jira.yasdb.com/browse/YDBRD-13318?src=confmacro)    **-**  **【OM】yasboot集成yascheck进行规格检测**  **完成**    [YDBRD-13322](https://jira.yasdb.com/browse/YDBRD-13322?src=confmacro)    **-**  **【OM】集群安装前检查共享磁阵状态**  **完成**

# **2、需求分析**

## **2.1 需求描述**

- 支持  使用yascheck进行环境信息收集
- 支持使用yascheck进行规格检测
- 支持yascheck进行检查项配置项修改


## **2.2 功能特性**

- **增加yasboot package check gen命令，用来生成检查项配置文件**


|Usages: yasboot package check gen [<flags>],gen yascheck items config,Flags:,  
  -h,--help   Show detailed help information.    
  -p,--path  check config generate path    
  --ip           ip used as the network test server,  
|
|:---|


- **增加yasboot check collect 命令，使用**  **yascheck对主机进行检查**


|Usages: yasboot check collect [<flags>],collect information from host,Flags:,  
  -h,--help          Show detailed help information.    
  -c,--cluster       yasdb cluster name    
  --ssh                used hosts in hosts.toml(default: false)    
  --hostid           specific hostid    
  -f,--format       output formation    
  -o,--output      output path    
  -t,--toml          config gen toml file    
  -n,--fileName  set the file name for the yascheck report    
  --disable         shield running progress(default: false)    
  -w,--nowait     do not wait commands result(default: false)    
  -d,--child         show task info with children task itself(default: false),  
|
|:---|


## **2.3 特性约束**

仍然保留需要root权限的参数，但是若无root权限则忽略该参数检查  （或者提示该参数permission denied）

不依赖hosts.toml文件执行，但是若提供hosts.toml，则优先toml文件执行

主机检查支持单主机检查（指定hostid），也支持全部agent检查。

检查规格结果获取？保留原有的计分规则，直接输出包含计分结果在内的详细信息。

所有主机共用一个配置文件。

暂不支持额外指定检查某些参数。

# **3、测试设计方法**

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计 

测试点：

1.参数校验：是否选填、必填、验证是否生效、填写错误参数、–cluster --ssh --toml生效关系

2.部署模式：yasom多机部署

3.配置文件：验证检查项ignore是否生效、检查用户修改检查命令是否生效

4.权限验证：不带sudo免密权限的用户会跳过哪些检查项

5.规格检测：检查项告警级别设置是否会根据实际情况生效

# **4、详细测试设计**

## **4.1 参数验证**

|命令|参数|  
|
|---|---|---|
|yasboot package check gen|-p, --path|正常存在的路径|
|  
|  
|不存在的路径|
|  
|  
|不加参数|
|  
|--ip|本机ip|
|  
|  
|内网其他机器ip|
|  
|  
|不存在的ip|
|  
|  
|不符合格式的ip|
|  
|  
|不加参数|
|yasboot check collect|-c,--cluster|填写存在的cluster|
|  
|  
|填写不存在的cluster|
|  
|  
|不加参数|
|  
|--ssh|添加参数，检查hosts.toml内主机|
|  
|  
|不加参数，只使用文件中检查项配置|
|  
|--hostid|指定不存在的主机|
|  
|  
|不加参数|
|  
|-f,--format|json,html及错误的格式|
|  
|  
|不加参数|
|  
|-o,--output|正常存在的路径|
|  
|  
|不存在的路径|
|  
|  
|不加参数|
|  
|-t,--toml|填写config gen生成文件|
|  
|  
|填写hosts.toml|
|  
|  
|填写旧版hosts.toml（不带yascheck检查项）|
|  
|  
|填写格式错误的文件|
|  
|  
|填写不存在的文件|
|  
|  
|不加参数|
|  
|-n,--fileName|填写参数|
|  
|  
|不加参数|
|  
|--disable|添加参数，不显示任务执行过程|
|  
|-w,--nowait|添加参数，不阻塞直接返回uuid|
|  
|-d,--child|添加参数，显示子任务|
|  
|--ssh,--toml|添加--ssh同时不添加--toml是否报错|
|  
|  
|添加--ssh同时–toml指定config gen生成文件是否报错|
|  
|--ssh,--toml,--cluster,--hostid|同时添加--ssh,--toml,--cluster,--hostid，按哪个生效|
|  
|  
|同时添加--toml,--cluster,--hostid，按哪个生效|


## **4.2 检查项配置**

|配置项|  
|
|---|---|
|是否跳过检查|跳过检查|
|  
|不跳过检查|
|自定命令|自定命令是否生效|


## **4.3 检查项及得分依据**

验证检查结果是否符合实际，  告警级别是否按设计生效

|一级分类|二级分类|  
|
|---|---|---|
|hardware|cpu|physical|
|  
|  
|logical|
|  
|  
|cores_per_cpu|
|  
|memory|  
|
|  
|disk|  
|
|  
|network|dns|
|  
|  
|gateway|
|  
|  
|status|
|system_params|base_info|selinux|
|  
|  
|io_schedule|
|  
|  
|en_lang|
|  
|sysctl|sysctl|
|  
|users|user_privilege|
|  
|  
|sudo_users|
|  
|  
|need_login_users|
|service|sys_service|enabled_service|
|  
|  
|running_service|
|  
|ssh_info|enabled|
|  
|  
|Status|
|  
|  
|config_path|
|  
|  
|protocol|
|  
|  
|permit_root_login|
|  
|firewalld|status|
|  
|  
|enabled|
|  
|  
|open_ports|
|  
|listening_info|listening_service|
|process_consumption|  
|cpu_top10|
|  
|  
|mem_top10|
|network_io|server|  
|
|  
|client|  
|
|disk_io|  
|  
|


  [yascheck 工具需求内容 - 杨德柳 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=59632660)  

### ulimit

命令： ulimit -a

|配置项|当前值|INFO|WARN|CRITICAL|备注|
|:---|:---|:---|:---|:---|:---|
|core file size      |0|value!=unlimited|value=0|  
|core文件的最大值|
|data seg size       | unlimited|value!=unlimited|  
|  
|  
|
|scheduling priority |0|  
|  
|  
|  
|
|file size           | unlimited|value!=unlimited|  
|  
|  
|
|pending signals     |63445|  
|  
|  
|  
|
|max locked memory   |64|  
|  
|  
|  
|
|max memory size     | unlimited|  
|  
|  
|  
|
|open files          |1024|value<65535|value<1024|  
|单个进程最多可以同时打开1024个文件|
|pipe size           |8|  
|  
|  
|  
|
|POSIX message queues|819200|  
|  
|  
|  
|
|real-time priority  |0|  
|  
|  
|  
|
|stack size          |8192|  
|  
|  
|  
|
|cpu time            | unlimited|value!=unlimited|  
|  
|进程使用的CPU时间|
|max user processes  |4096|  
|value<1024|  
|  
|
|virtual memory      | unlimited|  
|  
|  
|  
|
|file locks          | unlimited|  
|  
|  
|  
|


  


### sysctl

命令：sysctl -a

|配置项|value|INFO|WARN|CRITICAL|说明|
|:---|:---|:---|:---|:---|:---|
|vm.swappiness |0|  
|value!=0|value>90|系统在进行swap时，内存使用的相对权重|
|vm.dirty_ratio |100|value>10|  
|  
|文件系统缓存脏页数量达到系统内存的百分比，将触发异步回写|
|vm.dirty_background_ratio |40|value>5|  
|  
|文件系统缓存脏页数量达到系统内存的最大百分比，达到后新的IO将被阻塞。|
|vm.dirty_expire_centisecs |3000|  
|  
|  
|表示page cache中的数据多久标记为脏|
|vm.vfs_cache_pressure |200|  
|  
|  
|回收用于directory和inode cache内存的倾向，  该值低于100，将导致内核倾向于保留directory和inode cache；增加该值超过100，将导致内核倾向于回收directory和inode cache|
|vm.min_free_kbytes |1048576|value<1G|  
|  
|表示强制Linux VM最低保留多少空闲内存|
|vm.overcommit_memory |2|  
|  
|  
|内核对内存分配的一种策略,0：  OVERCOMMIT_GUESS     表示根据系统当前可用page frame进行判断，如果可用page frame大于申请的虚拟内存，则允许申请虚拟内存；,1：  OVERCOMMIT_ALWAYS     表示总是允许申请虚拟内存，没有任何限制；,2：  OVERCOMMIT_NEVER     表示不允许超过系统设置的虚拟内存限制。|
|vm.overcommit_ratio |85|  
|  
|  
|CommitLimit = (Physical RAM * vm.overcommit_ratio / 100) + Swap，overcommit_memory =2时生效。|
|vm.max_map_count |262144|  
|  
|  
|限制一个进程可以拥有的VMA(虚拟内存区域)的数量|


  


### 文件系统信息

|检查项|INFO|WARN|CRITICAL|说明|
|:---|:---|:---|:---|:---|
|操作系统和内核版本|  
|  
|  
|uname -a|
|内存信息|value < 8G|  
|  
|cat /proc/meminfo|
|CPU核数|value < 4|  
|  
|cat /proc/cpuinfo|
|当前安装包所在盘剩余空间|value < 10G|value < 4G|value < 1G|df -h|
|系统盘剩余空间|value < 10G|value < 4G|value < 1G|df -h|
|防火墙状态|value == 开|  
|  
|iptables -L systemctl status firewalld|
|selinux|value == 开|  
|  
|cat /etc/selinux/config|


### 进程相关

|检查项|INFO|WARN|CRITICAL|说明|
|:---|:---|:---|:---|:---|
|进程状态|  
|  
|value == stop|yasctl status|
|monit状态|  
|monit == stop|  
|yasctl monit run summary|
|日志|  
|ERROR = TRUE|  
|cat log/xxx/xxx.log | grep ERROR|


## **4.4 权限校验**

|本地用户|远程用户|
|---|---|
|免密sudo|免密sudo|
|sudo(不免密)|免密sudo|
|免密sudo|sudo(不免密)|
|不具有sudo权限|不具有sudo权限|


## **4.5 前端检查**

前端是否可以展示json全部信息

  


## Comments:

|  [](null)  ,1）host或指定主机故障时，yasckeck进行环境信息收集；,2）yascheck输出路径满的时候是否能报错；,3）检测输出结果中显示内容是否正确。,Posted by shixinhua at 五月 15, 2023 16:59|
|---|
