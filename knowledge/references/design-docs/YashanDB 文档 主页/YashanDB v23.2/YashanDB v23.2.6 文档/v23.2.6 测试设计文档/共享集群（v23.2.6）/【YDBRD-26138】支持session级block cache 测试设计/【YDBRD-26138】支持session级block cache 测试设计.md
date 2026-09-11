Created by 牛亚娜, last modified on 十月 11, 2024

**IR链接：**

  [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf00](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf00)    **?**    
  **#YASHAN-1012 支持session级block cache**

**SR链接：**

  [https://pingcode.yasdb.com/pjm/items/6618d5a6fd997db58ad808d1](https://pingcode.yasdb.com/pjm/items/6618d5a6fd997db58ad808d1)    **?**    
  **#YDBRD-26138 支持session级block cache**

**开发设计文档链接：**    [Session级资源 cache - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141584551)  

# 1. 概述

背景：全局资源在访问时，通常需要通过加锁控制并发。在并发较高的情况下，spin lock冲突会很大，尤其是在ARM架构下，lock引起cache line失效会导致很容易出现跨NUMA节点的内存访问，严重影响并发性能。目前开发识别到的主要瓶颈有以下两种

- block页面锁
- table表锁


# 2. 需求分析

高并发读的场景下，通过session级别的block cache，降低全局buffer的锁冲突

## 2.1 功能点分析

**2.1.1 增加本地cache机制**

增加两种锁资源可以放到本地cache中：block lock和table lock，本次主要测试block lock

block lock资源在session读较多的场景下，就会进入本地cache

本地cache失效：当资源状态发生变化时，本地cache会被失效：当其他实例做DML写操作，会给block加排他锁，会失效本地cache相关block锁

**2.1.2 相关参数**

_SESSION_CACHE_BLOCKS: 控制每个session cache block lock的数量，默认0，取值范围 0 ~ 1023，重启生效

_SESSION_CACHE_TABLES: 控制每个session cache table lock的数量，默认16，取值范围 0 ~ 1023，重启生效

_SESSION_BLOCK_CACHE_THRESHOLD：当某个block的shareCount大于该参数时，才会被cache到本地，默认32 ，取值范围1 ~ 65535，重启生效

**2.1.3 相关视图**

V$SESSION_LOCK_CACHES: 查看每个session的cache情况：

|字段|类型|说明|
|:---|:---|:---|
|SID|INTEGER|会话ID|
|CACHE_TYPE|VARCHAR(16)|LOCK CACHE类型：TABLE CACHE、BLOCK CACHE|
|TOTAL|BIGINT|产生LOCK CACHE的总数（包含当前存在的数目以及被复用的数目）|
|HITS|BIGINT|LOCK CACHE命中次数|
|INVALIDS|BIGINT|LOCK CACHE失效次数|
|MISS|BIGINT|LOCK CACHE未命中次数|
|COUNT|BIGINT|当前LOCK CACHE的总数|


**2.1.4 相关统计项**

- BUFFER READ CACHE TOTAL: block lock被cache到session的总次数（包含槽位复用）
- BUFFER READ CACHE HITS: block lock cache命中的次数
- BUFFER READ CACHE INVALIDS ：block lock cache被失效的次数（包含槽位复用）
- BUFFER READ CACHE MISS : block lock cache未命中的次数
- TABLE LOCK CACHE TOTAL: table lock被cache到session的总次数 （包含槽位复用）
- TABLE LOCK CACHE HITS: table lock cache命中的次数
- TABLE LOCK CACHE INVALIDS ：table lock cache被失效的次数（包含槽位复用）
- TABLE LOCK CACHE MISS : table lock cache未命中次数


## 2.2 应用场景

- 开启block cache之后，对高并发读热点数据的性能提升
- 分别开启/关闭 block cache之后，对TPCC性能影响不大


## 2.3 规格约束

- 产品形态：单机、集群、分布式


# 3. 详细测试设计

## 3.1 测试设计方法

- 该需求的测试主要围绕本地cache新增机制  来展开测试，场景比较明确，主要采用的是场景法
- 针对该机制影响到的产品形态，采用覆盖法进行测试
- 视图层面的变更，采用视图公共测试方法
- 性能层面的测试，采用的是对比测试法
- 配置参数的测试，采用配置参数公共测试方法即可，主要使用等价类/边界值类和错误推测类方法


## 3.2 关联特性/依赖分析

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|是|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR|是|
|HA|/|
|压力|是|
|性能|是|
|可维护性|/|
|RTO|/|


## 3.3 详细测试设计

### 3.3.1 已有CI工程验证（_SESSION_CACHE_BLOCKS=16，_SESSION_BLOCK_CACHE_THRESHOLD=3）

主要涉及功能工程，CT工程，KT工程，一致性工程，包含单机、集群、分布式形态

详细的工程列表参考：    [复制工程](https://conf.yasdb.com/pages/viewpage.action?pageId=167159056)      [问题验证](https://jenkins.yasdb.com/user/niuyana/my-views/view/%E9%97%AE%E9%A2%98%E9%AA%8C%E8%AF%81/)  

### 3.3.2   **本地cache**  机制验证

（1）针对高并发读热点数据的性能测试，主要构造方式：构造普通表，  多会话并发读指定的几个block  ，观测查询的时间

这部分测试时考虑的测试因子如下：

|测试因子|有效等价类|无效等价类|备注|
|---|---|---|---|
|产品形态|单机|  
|  
|
|  
|分布式|  
|  
|
|  
|集群|  
|  
|
|对象类型|普通表|临时表（原则上临时表相关并发读场景下，查询V$SESSION_LOCK_CACHES中BLOCK CACHE的值恒为0）|表上带索引|
|表的个数|单张表|  
|  
|
|操作类型|基本dql操作并行|  
|  
|
|执行操作的实例|单实例多session|  
|  
|
|  
|多实例多session|  
|  
|
|_SESSION_CACHE_BLOCK值|0|  
|  
|
|  
|16|  
|  
|
|_SESSION_BLOCK_CACHE_THRESHOLD值|1|  
|  
|
|  
|8|  
|  
|
|  
|16|  
|  
|
|  
|32|  
|


使用jdbc构造查询

|场景|参数配置|结果|
|---|---|---|
|普通表，1个block，800并发，每个40000循环|_SESSION_CACHE_BLOCKS=16 _SESSION_BLOCK_CACHE_THRESHOLD=1 RUN_LOG_LEVLE=INFO|![](https://pingcode.yasdb.com/atlas/files/public/67396df68970c2af4f52161e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|
|普通表，5个block，100并发，每个40000循环|_SESSION_CACHE_BLOCKS=16 _SESSION_BLOCK_CACHE_THRESHOLD=1 RUN_LOG_LEVLE=INFO|![](https://pingcode.yasdb.com/atlas/files/public/67396df68970c2af4f52161f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|
|普通表，普通索引，5个block，800并发，每个40000循环|_SESSION_CACHE_BLOCKS=16 _SESSION_BLOCK_CACHE_THRESHOLD=1 RUN_LOG_LEVLE=INFO|![](https://pingcode.yasdb.com/atlas/files/public/67396df6a1ad9a3311dc9491/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|


执行流程：

```
【1】参数配置：
DATA_BUFFER_SIZE=2G
_DATA_BUFFER_PARTS=8
VM_BUFFER_SIZE=128M
VM_BUFFER_PARTS=8
_REPLICATION_BUFFER_SIZE=128M
REDO_BUFFER_SIZE=64M
REDO_BUFFER_PARTS=8
WORK_AREA_POOL_SIZE=2G
SQL_POOL_PARTS=8
RUN_LOG_LEVEL=INFO
RECOVERY_PARALLELISM=8
HA_ELECTION_TIMEOUT=18
HA_HEARTBEAT_INTERVAL=6
JVM_XMX=8G
JVM_XMS=4G
SHARE_POOL_SIZE=2G
RUN_LOG_FILE_COUNT=200
ARCH_CLEAN_IGNORE_MODE=BACKUP
ARCH_CLEAN_LOWER_THRESHOLD=200M
ARCH_CLEAN_UPPER_THRESHOLD=1G
SECURE_FILE_PRIV='/'
_SESSION_CACHE_BLOCKS=16
_SESSION_BLOCK_CACHE_THRESHOLD=1
MAX_WORKERS=1024
MAX_SESSIONS=2048
_SESSION_RESERVED_CURSORS=64
【2】部署环境
【3】创建基表，预置数据，创建索引
create table tb_ydbrd_26138_001(id int,c1 char(200),c2 varchar(2000),c3 varchar(8000),c4 date,c5 number);
create index idx1 on tb_ydbrd_26138_001(id);
declare
begin
    for i in 1 .. 150 loop
		insert into tb_ydbrd_26138_001 values(i,lpad('char',10,i),lpad('b',10,'b'),lpad('varchar',10,i),'2023-06-01',i);
		commit;
	end loop;
end;
/
【4】刷盘，退出3的会话后再次连接执行alter system checkpoint;
【5】连接jdbc进行查询
cd /data/nyn/jdbc
export CLASSPATH=`pwd`/yashandb-jdbc-1.7.10-9-gad98556c.jar:${CLASSPATH}
javac Test014.java
java testMain2 > Test014.log
【6】执行结束后观测视图变化
select * from v$spinLock where name = 'BUFFER POOL BUCKET';
select * from v$sysstat where name like '%BUFFER READ CACHE%';
【7】Test014.java代码如下：
import java.sql.*;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Random;
import java.util.ArrayList;
import java.util.List;

public class Test014 {
    public static void main(String[] args) throws InterruptedException {
        ExecutorService executor = Executors.newFixedThreadPool(1000);
        CountDownLatch latch = new CountDownLatch(800);
        
        System.out.println("Starting 800 threads...");

        for (int i = 0; i < 800; i++) {
            executor.submit(new Test014_thread(i, latch));
        }

        latch.await(); // 等待所有线程准备好
        System.out.println("All threads have finished.");
        executor.shutdown();
    }
}

class Test014_thread extends Thread {
    private final int threadId;
    private final CountDownLatch latch;

    public Test014_thread(int id, CountDownLatch latch) {
        this.threadId = id;
        this.latch = latch;
    }
	public void run() {
		try {
			// 准备工作，减少计数
			latch.countDown(); 
			latch.await(); // 等待所有线程准备完成
			
			System.out.println("Thread " + threadId + " is starting.");
			List<Long> times = new ArrayList<>(); // 用于存储查询时间

			try (Connection conn = openDB()) { // 打开数据库连接
				String sql = "SELECT * FROM tb_ydbrd_26138_001 where id between 10 and 140"; 
				try (PreparedStatement ps = conn.prepareStatement(sql)) {
					for (int i = 0; i < 40000; i++) { 
						long start = System.currentTimeMillis();
						
						try (ResultSet rs = ps.executeQuery()) {
							while (rs.next()) {
								// 处理结果集
							}
						}
						
						long end = System.currentTimeMillis();
						long duration = end - start;

						// 记录查询时间
						times.add(duration);
						
						// 如果超过 100 次，则移除最早的记录
						if (times.size() > 100) {
							times.remove(0);
						}
					}
				} catch (SQLException e) {
					e.printStackTrace(); 
				}
			} catch (SQLException | ClassNotFoundException e) { 
				e.printStackTrace(); 
			}

			// 输出最后 100 次查询的时间
			System.out.println("Thread " + threadId + " last 100 query times:");
			long total = 0; // 累加查询时间
			for (Long time : times) {
				System.out.println("Cost: " + time + " ms");
				total += time; // 累加每次的查询耗时
			}

			// 计算平均值
			double average = times.size() > 0 ? total / (double) times.size() : 0;
			System.out.println("Average query time: " + average + " ms");

			System.out.println("Thread " + threadId + " has finished.");
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}

	
    public static Connection openDB() throws SQLException, ClassNotFoundException {
        Class.forName("com.yashandb.jdbc.Driver");
        Properties props = new Properties();
        String url = "jdbc:yasdb://192.168.24.183:1601/yasdb";
        String user = "sys";
        String password = "Cod-2022";
        props.setProperty("user", user);
        props.setProperty("password", password);
        return DriverManager.getConnection(url, props);
    }
}
```

考虑sysbench模型：

tables=128

tablesize=250000

runtime=300

threads=128/256

|  
|threads=128|threads=256|备注|cmd|
|:---|:---|:---|:---|:---|
|read write|  
|  
|单实例多session,_SESSION_CACHE_BLOCK=16/1023,_SESSION_BLOCK_CACHE_THRESHOLD=10/32,多实例多session,_SESSION_CACHE_BLOCK=16/1023,_SESSION_BLOCK_CACHE_THRESHOLD=10/32|./src/sysbench ./src/lua/oltp_read_write.lua --report-interval=2 --tables=128 --table_size=250000 --yashan-db=127.0.0.1:1689 --yashan-user=regress --yashan-password=regress --time=300 --threads=128 run,  
,./src/sysbench ./src/lua/oltp_read_write.lua --report-interval=2 --tables=128 --table_size=250000 --yashan-db=127.0.0.1:1689 --yashan-user=regress --yashan-password=regress --time=300 --threads=256 run|
|read only|  
|  
|单实例多session,_SESSION_CACHE_BLOCK=16/1023,_SESSION_BLOCK_CACHE_THRESHOLD=10/32,多实例多session,_SESSION_CACHE_BLOCK=16/1023,_SESSION_BLOCK_CACHE_THRESHOLD=10/32|./src/sysbench ./src/lua/oltp_read_only.lua --report-interval=2 --tables=128 --table_size=250000 --yashan-db=127.0.0.1:1689 --yashan-user=regress --yashan-password=regress --time=300 --threads=128 run,  
,./src/sysbench ./src/lua/oltp_read_only.lua --report-interval=2 --tables=128 --table_size=250000 --yashan-db=127.0.0.1:1689 --yashan-user=regress --yashan-password=regress --time=300 --threads=256 run|


（2）针对TPCC性能测试

这部分主要验证两方面：开启/关闭 block cache之后，性能对比

|  
|场景|备注|
|---|---|---|
|1|集群，_SESSION_CACHE_BLOCKS设置为0（默认值），_SESSION_CACHE_TABLES设置为16（默认值），运行TPCC模型|![](https://pingcode.yasdb.com/atlas/files/public/67396df6a1ad9a3311dc9492/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|
|2|集群，_SESSION_CACHE_BLOCKS设置为16，_SESSION_CACHE_TABLES设置为16，_SESSION_BLOCK_CACHE_THRESHOLD设置为32，运行TPCC模型|![](https://pingcode.yasdb.com/atlas/files/public/67396df68970c2af4f521620/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|
|3|单机，_SESSION_CACHE_BLOCKS设置为0（默认值），_SESSION_CACHE_TABLES设置为16（默认值），运行TPCC模型|  
|
|4|单机，_SESSION_CACHE_BLOCKS设置为16，_SESSION_CACHE_TABLES设置为16，_SESSION_BLOCK_CACHE_THRESHOLD设置为32，运行TPCC模型|![](https://pingcode.yasdb.com/atlas/files/public/67396df6a1ad9a3311dc9493/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|


### 3.3.3 参数验证

配置参数的测试主要从以下几个角度来做验证，主要使用边界值法和等价类划分法（  审视已有测试是否全面  ）

- 参数名称的命名规范性（名称中无缩写，隐藏参数以下划线开始）
- 新增参数是否有在产品文档里新增对应的资料描述
- 参数的类型是否正确（隐藏参数/非隐藏参数）
- 参数设置成对应值时的业务场景的测试
- 参数生效方式的验证
- 参数取值的验证
- 基础语法验证


|测试场景|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|
|参数命名的规范性验证|  
|  
|参数名称无缩写，隐藏参数以"_"开头|
|对应参数在资料中有新增，新增信息是否正确|  
|  
|  
|
|参数类型验证|  
|  
|隐藏参数在x$parameter中，非隐藏参数在v$parameter中|
|参数生效方式验证|重启生效-直接写入配置文件启动DB|  
|  
|
|  
|重启生效-通过alter system修改后重启DB|设置scope为"both"/"memory"|  
|
|  
|立即生效-直接写入配置文件启动DB|  
|  
|
|  
|立即生效-通过alter system修改|设置scope为"both"/"spfile"|对于立即生效的参数，设置为"both"/"spfile"/"memory"都可以设置成功|
|参数值校验|默认值|  
|  
|
|  
|最大值|越界值-大于最大值|  
|
|  
|最小值|越界值-小于最小值|  
|
|  
|中间值|  
|  
|
|  
|  
|值为空，值为NULL，值为空串|  
|
|  
|  
|值为特殊字符：中文，小数，非指定的可选项，#￥#…………这类特殊字符|  
|
|  
|  
|在配置文件中，给该参数设置2次值，且2次的值不相同|  
|
|语法验证|  
|关键字缺失-参数名缺失/生效方式关键字缺失|主要是异常场景|
|  
|  
|关键字错误-参数名错误/生效方式关键字错误/不存在|  
|
|业务场景测试|  
|  
|设置不同值时，观测对性能的影响|


### 3.3.4 视图验证

如果新增视图，视图的测试主要从以下几个角度来做验证（  审视已有测试是否全面  ）

- 视图名称的命名规范性
- 新增视图是否有在产品文档里新增对应的资料描述
- 在相关业务场景下，视图字段值的准确性测试
- 视图所包含字段的测试
- 视图查询（是否带filter）的测试
- 视图拦截验证测试
- 视图并发查询测试


|测试场景|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|
|视图命名的规范性验证|命名规范|命名不规范|  
|
|对应视图在资料中有新增，新增信息是否正确|新增信息正确|新增信息不正确|  
|
|视图所包含字段的测试|字段正确|字段错误|查询时可验证字段的大小写情况|
|视图字段值的准确性测试|字段值准确|字段值不准确|构造相应的场景看字段值是否准确且合理|
|  
|动态值可以被捕获|动态值无法捕获|构造相应的场景看动态值的变化能否被捕捉|
|视图查询（是否带filter）的测试|查询不带filter，查询结果匹配准确|查询不带filter，查询结果匹配不准确|  
|
|  
|查询带filter，filter条件正确|查询带filter，filter条件不正确|  
|
|  
|添加filer后的查询结果匹配准确|添加filer后的查询结果匹配不准确|  
|
|视图拦截测试|修改、删除等操作被拦截，无法成功操作|修改、删除等操作未被拦截，成功操作|  
|
|视图并发查询测试|带业务并发查询视图，表现正常|带业务并发查询视图，表现异常|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

[测试记录.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjQ4OTcwYzJhZjRmNTIxNjE0IiwicmVmX2lkIjoiNjczOTZkZjQ3MjgyMDZlZmI5MmYyNGE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTQ3LCJleHAiOjE3ODIzOTk1NDd9.Xvf4JfdjTc9RUzlwyCB_suNG2eBJIt65FZ1LdqYt_2M)

# 7. 工作量评估

工作量：xx  *人天*

计划测试完成时间：xx

# 8. 测试用例维护

- *规划不同类型的用例自动化看护的是哪个库，哪个文件夹，哪个调度，是否需要新增工程*
- *确认用例耗时情况，若有耗时久的，进行备注*


|测试项|框架|目录|备注|
|:---|:---|:---|:---|
|  
|  
|  
|  
|
|  
|  
|  
|  
|


# 9. 上车分析

  [Agile_master_L2_Build #5437 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5437/)  

![](https://pingcode.yasdb.com/atlas/files/public/67396df6a1ad9a3311dc9494/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)

![](https://pingcode.yasdb.com/atlas/files/public/67396df68970c2af4f521621/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)

![](https://pingcode.yasdb.com/atlas/files/public/67396df6a1ad9a3311dc9495/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)

|  
|失败工程|失败用例|失败原因|备注|
|---|---|---|---|---|
|1|  [Agile_L2_sa_upgrade_FT_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4448/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396df68970c2af4f521622/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|公共问题|  [Agile_L2_sa_upgrade_FT_2_docker #4451 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4451/)  |
|2|  [Agile_L2_sa_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/3859/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396df68970c2af4f521623/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|主干问题|  
|
|3|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4296/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396df6a1ad9a3311dc9496/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw),![](https://pingcode.yasdb.com/atlas/files/public/67396df68970c2af4f521624/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|并发/不稳定|  [Agile_L2_sa_heap_yasft_arm #4300 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4300/)  |
|4|  [Agile_L2_sa_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3651/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396df6a1ad9a3311dc9497/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|用例不稳定|  
|
|5|  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3753/)  |  
|  
|  [Agile_L2_cluster_yasft_cluster_case_arm #3757 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/Agile_L2_cluster_yasft_cluster_case_arm/3757/)  ,  [Agile_L2_cluster_yasft_cluster_case_arm #3763 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/Agile_L2_cluster_yasft_cluster_case_arm/3763/)  |
|6|  [Agile_L2_cluster_yasft_yfs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3150/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396df68970c2af4f521625/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|主干问题，用例不稳定|pass|
|7|  [Agile_L2_cluster_FT_sqlloader_1_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_sqlloader_1_arm/776/)  |  
|用例不稳定，已跑绿|  [Agile_L2_cluster_FT_sqlloader_1_arm #779 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_sqlloader_1_arm/779/)  |
|8|  [Agile_L2_cluster_FT_install_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_install_arm/727/)  |  
|公共问题|  
|
|9|  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3156/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396df6a1ad9a3311dc9498/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|用例不稳定|  
|
|10|  [Agile_L2_dst_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2923/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396df6a1ad9a3311dc9499/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBR0JBZ0VBQkJBQUFFQ0FBQ0FBZ0FBQUFsQUFBREFBQUlDQkFBQUFBQWlBZ0FBSUFBQUtJd2tBQUFBQlFRRmlJQWdBQUFFQUFBQVFBQUFFQUNBQUFEQUNBSkNCQUFBQVFBQUFBQUFCSUFRQ0NBQUFBQUFJQUpBQVVCQ0FBQWdBQUFBQUNBQUFFQUFBQUFvQWdCNFJBQUFBQkFBQXdBQkFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNDcsImV4cCI6MTc4MjMyMzk0N30.ArWyS3i7yv7fpK-nyckvU9un2Dqchc_Ig4CmayuH3tw)|用例不稳定|  
|


# 10. TBD

后续需要加固测试或者补充测试的场景

## Attachments:

[image2024-10-11_18-40-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjU4OTcwYzJhZjRmNTIxNjFjIiwicmVmX2lkIjoiNjczOTZkZjQ3MjgyMDZlZmI5MmYyNGE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTQ3LCJleHAiOjE3ODIzOTk1NDd9.Uc-LH3prhx5byn-aC2lrT4Ksv39nlXM8dal_cZeaCC4)

 (image/png)    


[Test014.java](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjVhMWFkOWEzMzExZGM5NDkwIiwicmVmX2lkIjoiNjczOTZkZjQ3MjgyMDZlZmI5MmYyNGE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTQ3LCJleHAiOjE3ODIzOTk1NDd9.W9njJv4WbiEaC4L3B-GE6NNPIYpyLHlSwIs5SXGBhuM)

 (text/x-java-source)    


[测试记录.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjQ4OTcwYzJhZjRmNTIxNjE0IiwicmVmX2lkIjoiNjczOTZkZjQ3MjgyMDZlZmI5MmYyNGE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTQ3LCJleHAiOjE3ODIzOTk1NDd9.Xvf4JfdjTc9RUzlwyCB_suNG2eBJIt65FZ1LdqYt_2M)

 (application/octet-stream)    


## Comments:

|  [](null)  ,一、会议时间：2024/9/12 15：00-15：30    
  二、会议地点：腾讯会议    
  三、会议主持人：牛亚娜    
  四、参会人员：陈宜顺、黄杨波、张丽红、牛亚娜    
  五、会议主题： 支持session级block cache 测试设计    
  六、会议总结    
  1、重点测试：在开启cache时，高并发读指定的几个block的查询性能    
  2、场景设计时，增加索引,Posted by niuyana at 十月 14, 2024 09:03|
|---|
