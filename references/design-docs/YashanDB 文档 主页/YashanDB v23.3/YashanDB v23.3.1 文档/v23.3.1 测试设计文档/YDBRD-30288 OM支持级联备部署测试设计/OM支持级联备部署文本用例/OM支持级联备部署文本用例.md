Created by 李世铭, last modified by  瞿蓝孟 on 八月 12, 2024

|序号|测试点|级别|预置条件|测试步骤|预期结果|备注|进度（已测完/已自动化）|
|---|---|---|---|---|---|---|---|
|1|cascaded-node默认值|L0|已解压数据库包|1.生成配置文件，指定一主二备，不指定cascaded-node，使用yasboot package config show命令检查配置文件结构|配置文件中没有级联备节点|1.使用pckage se gen 命令进行测试，尽量不要使用package config gen命令，计划后续某个版本去掉。,2.yasboot package config show查看不了级联备的父节点信息，只有部署后的cluster status命令可以查看|自测完成|
|2|cascaded-node取值范围|L1|已解压数据库包|1.生成配置文件，指定一主五备二十七级联，使用package config show命令检查配置文件结构,2.生成配置文件，指定一主六备二十七级联,3.生成配置文件，指定一主二备，cascaded-node设置为-1,4.生成配置文件，指定一主二备，cascaded-node设置为a|1.生成配置文件成功，节点结构符合预期,2.报错备节点加级联备节点数超过限制,3.报错，非法值,4.报错，非法值|  
|自测完成|
|3|cascaded-parent默认值|L0|已解压数据库包|1.生成配置文件，指定一主三备二级联，不指定  cascaded-parent，使用yasboot package config show命令检查配置文件结构|级联备的父节点都为第三个备节点|config show命令看不出来级联备的父节点|-|
|4|cascaded-parent取值范围|L1|已解压数据库包|1.生成配置文件，指定一主三备二级联，指定  cascaded-parent为1，使用yasboot package config show命令检查配置文件结构,2.生成配置文件，指定一主三备二级联，指定cascaded-parent为4,3.生成配置文件，指定一主三备二级联，指定cascaded-parent为0,4.生成配置文件，指定一主三备二级联，指定cascaded-parent为a|1.生成配置文件成功，级联备都绑定在第一个备节点,2.报错没有第四个备节点,3.报错非法取值,4.报错非法取值|3.由于是选填参数，默认值是0，为0的时候自动找最后一个备节点|自测完成|
|5|正常部署|L0|已解压数据库包|1.生成配置文件，指定  一主二备二级联，cascaded-parent默认,2.执行package install和cluster deploy安装部署数据库,3.执行cluster status查询集群状态|1.生成配置文件成功,2.部署成功,3.集群状态信息显示正确，级联备database_role显示为  standby（cascade），source_node都绑定为第二个备节点|  
|自测完成|
|6|最大规模部署|L3|已解压数据库包|1.生成配置文件，指定  一主二备三十级联，cascaded-parent默认,2.执行package install和cluster deploy安装部署数据库,3.执行cluster status查询集群状态|1.生成配置文件成功,2.部署成功,3.集群状态信息显示正确，级联备database_role显示为  standby（cascade），source_node都绑定为第二个备节点|  
|  
|
|7|指定级联备父节点部署|L1|已解压数据库包|1.生成配置文件，指定  一主三备二级联，cascaded-parent指定为1,2.执行package install和cluster deploy安装部署数据库,3.执行cluster status查询集群状态|1.生成配置文件成功,2.部署成功,3.集群状态信息显示正确，级联备database_role显示为  standby（cascade），source_node都绑定为第一个备节点|  
|自测完成|
|8|cluster启停|L1|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.执行cluster stop和cluster start，cluster status查看集群状态,2.执行cluster restart -s normal -m nomount，cluster status查看集群状态,3.执行cluster restart -s abort -m mount，cluster status查看集群状态|1.停启成功，集群状态正常,2.重启成功，instance_status显示为started，database_status和database_role为空,3.重启成功，instance_status显示为mounted，database_status显示为normal，级联备database_role显示为  standby（cascade）|  
|自测完成|
|9|group启停|L2|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.执行group stop和group start，group status查看集群状态,2.执行group restart -s normal -m nomount，group status查看集群状态,3.执行group restart -s abort -m mount，group status查看集群状态|1.停启成功，集群状态正常,2.重启成功，instance_status显示为started，database_status和database_role为空,3.重启成功，instance_status显示为mounted，database_status显示为normal，级联备database_role显示为  standby（cascade）|  
|  
|
|10|node启停|L2|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|选定级联备db-1-5,1.执行node stop和group start，node status查看节点状态,2.执行node restart -s normal -m nomount，node status查看节点状态,3.执行node restart -s abort -m mount，node status查看节点状态|1.停启成功，集群状态正常,2.重启成功，instance_status显示为started，database_status和database_role为空,3.重启成功，instance_status显示为mounted，database_status显示为normal，级联备database_role显示为  standby（cascade）|  
|  
|
|11|yasdb process启停|L2|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.在所有host执行yasdb process stop，查询yasdb process status和cluster status,2.在所有host执行yasdb process start，查询yasdb process status和cluster status|1.yasdb进程停止成功，查询所有yasdb都已停止,2.yasdb进程启动成功，查询集群状态正常|  
|  
|
|12|设置密码|L1|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.执行password set设置密码为Cod-2024,2.使用Cod-2024连接级联备|1.密码设置成功,2.连接成功|  
|自测完成|
|13|monit|L2|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.执行monit start,2.kill级联备，等待一段升级后查看是否被拉起|1.启动monit成功,2.kill备节点，等待一段时间后成功被拉起|  
|  
|
|14|配置参数|L1|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.cluster config set data_buffer_size 300M，重启数据库后查询cluster config show data_buffer_size    
  2.cluster config set data_buffer_size 350M，重启数据库后查询group config show data_buffer_size,3.node config set data_buffer_size 400M node_id 1-4，重启数据库后查询node config show data_buffer_size node_id 1-4|1.修改配置成功，重启数据库后查询data_buffer_size为300M,2.修改配置成功，重启数据库后查询data_buffer_size为350M,3.修改配置成功，重启数据库后查询db-1-4 data_buffer_size为400M|  
|自测完成|
|15|主备切换|L1|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.yasboot node switchover到db-1-2，cluster status查看集群状态,2.yasboot node switchover到db-1-3，cluster status查看集群状态,3.yasboot node switchover到db-1-4，cluster status查看集群状态,4.yasboot node switchover重新切换回db-1-1,5.yasboot node switchove切换回db-1-3，再切换回db-1-1，cluster status查看集群状态,6.yasboot node switchove切换到db-1-6|1.切换成功，db-1-2变为主，db-1-1变为备，其他节点状态不变,2.切换成功，db-1-3变为主，其他节点都为普通备,3.切换成功，db-1-4变为主，db-1-3为普通备，其他节点为db-1-3的级联备,4.切换失败，不可以直接切换到级联备,5.两次切换成功，集群节点恢复为最初状态,6.报错不存在此节点,  
|3.预期不对，1-1和1-4变成普通备，1-5变成了1-3的级联备，1-2未知。,4.切换成功，恢复到最初部署状态，1-2，1-3普通备，其他为1-3级联备,  
|自测完成|
|16|扩容普通备|L3|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.yasboot config node gen生成备机扩容配置文件,2.执行扩容，cluster status查看集群状态|扩容成功，查看集群状态已被扩容一个不带级联备的普通备|  
|  
|
|17|缩容普通备|L3|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.yasboot node remove移除db-1-2，cluster status查看集群状态|缩容成功，查看集群状态db-1-2已被移除，其他节点不受影响|  
|  
|
|18|缩容带级联备的备机|L3|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.yasboot node remove移除db-1-3|报错，备节点带级联备|  
|  
|
|19|缩容级联备|L3|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.yasboot node remove移除db-1-4|报错，不支持缩容级联备|  
|  
|
|20|普通备加级联备数量到达上限后扩容|L3|已部署一主二备三十级联数据库集群，级联备绑定为第二个备节点|1.yasboot config node gen生成备机扩容配置文件|报错，备加级联备数量已达上限|  
|  
|
|21|升级|L3|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|执行升级|检查升级模式退出顺序：备机-级联备-主机|  
|  
|
|22|yasbak备份恢复|L3|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.部署yasbak并从级联备创建备份集,2.执行yasbak restore,3.恢复备份集并指定--build-all|1.备份集创建成功,2.清理数据库数据成功,3.主备恢复成功，级联备仍为nomount状态，手动build database恢复正常|  
|  
|
|23|failover|L2|已部署一主二备二级联数据库集群，级联备绑定为第二个备节点|1.kill 1-1，failover到1-3,2.重新拉起集群，kill 1-1，failover到1-4,3.重新拉起集群，kill 1-3,，failover到1-4,4.重新拉起集群，kill 1-1和1-3，failover到1-6|1.failover成功，除原主外，其他节点状态正常，原级联备变为普通备,2.failover失败，报错级联备能连上父节点,3.failover成功，集群有双主但是互不相连,4.报错集群没有这个节点|  
|  
|
