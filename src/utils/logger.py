from datetime import datetime


class Logger:
    PREFIXES = {
        "API": '🌐',
        "DB": '💾',
        "AUTH": '🔐',
        "EMAIL": '📧',
        "SPIDER": '🕷️',
        "AWS": '🚀',
        "NETWORK": '🌐',
        "FILE": '📁',
        "SYSTEM": '💻',
        "DEBUG": '🐞',
        "INFO": 'ℹ️',
        "WARNING": '⚠️',
        "ERROR": '❌',
        "CRITICAL": '🔥',
        "SUCCESS": '✅',
        "ENV_KEY": '🔑',
        "TIMER": '🕒',
    }

    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Verde
        'WARNING': '\033[33m',  # Amarillo
        'ERROR': '\033[31m',    # Rojo
        'CRITICAL': '\033[35m', # Magenta
        'SUCCESS': '\033[92m',  # Verde brillante
        'RESET': '\033[0m'      # Reset
    }

    @classmethod
    def _get_timestamp(cls) -> str:
        """Obtener timestamp actual"""
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    @classmethod
    def _format_message(cls, level: str, prefix: str, message: str) -> str:
        """Formatear mensaje con prefijo y emoji"""
        emoji = cls.PREFIXES.get(prefix.upper(), "")
        if emoji:
            formatted_prefix = f"{emoji}"
        else:
            formatted_prefix = f"[{prefix.upper()}]"
        
        timestamp = cls._get_timestamp()
        return f"{timestamp} | {level.ljust(8)} | {formatted_prefix} {message}"
    
    @classmethod
    def _write_to_console(cls, level: str, formatted_message: str):
        """Escribir mensaje a consola con color"""
        color = cls.COLORS.get(level, "")
        reset = cls.COLORS['RESET']
        
        # Colorear solo el nivel
        level_display = level.ljust(8)
        colored_message = formatted_message.replace(
            f" | {level_display} | ", 
            f" | {color}{level_display}{reset} | "
        )
        
        print(colored_message)
    
    @classmethod
    def _log(cls, level: str, prefix: str, message: str):
        """Método interno para logging"""
        formatted_message = cls._format_message(level, prefix, message)
        
        # Escribir a consola
        cls._write_to_console(level, formatted_message)

    @staticmethod
    def debug(prefix: str, message: str):
        """Log nivel DEBUG"""
        from config import ENVIRONMENT
        
        if ENVIRONMENT == "DEV":
            Logger._log("DEBUG", prefix, message)
    
    @staticmethod
    def info(prefix: str, message: str):
        """Log nivel INFO"""
        Logger._log("INFO", prefix, message)
    
    @staticmethod
    def warning(prefix: str, message: str):
        """Log nivel WARNING"""
        Logger._log("WARNING", prefix, message)
    
    @staticmethod
    def error(prefix: str, message: str):
        """Log nivel ERROR"""
        Logger._log("ERROR", prefix, message)
    
    @staticmethod
    def critical(prefix: str, message: str):
        """Log nivel CRITICAL"""
        Logger._log("CRITICAL", prefix, message)
    
    @staticmethod
    def success(prefix: str, message: str):
        """Log nivel SUCCESS"""
        Logger._log("SUCCESS", prefix, message)
