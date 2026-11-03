import javax.sql.rowset.serial.SerialClob;
import java.lang.reflect.Method;
public class RecordClobReadCheck {
 public static void main(String[] args)throws Exception{
 Method method=Main.class.getDeclaredMethod("readRecordClob",java.sql.Clob.class);method.setAccessible(true);
 for(String text:new String[]{"","中文😀".repeat(400000),"a".repeat(1048575)+"中文😀"}){
 String actual=(String)method.invoke(null,new SerialClob(text.toCharArray()));
 if(!actual.equals(text))throw new AssertionError("CLOB mismatch");
 }
 System.out.println("PASS: empty, multi-chunk Chinese and surrogate boundary");
 }
}
