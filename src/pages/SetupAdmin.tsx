import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SetupAdmin = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/login", { replace: true });
  }, [navigate]);
  return null;
};

export default SetupAdmin;
